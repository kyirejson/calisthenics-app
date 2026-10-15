"""Test the production echo core on an owned Android emulator with generated audio.
No device microphone, live API, private user data, or production test hooks are used.
This is an acoustic-front-end regression, not acceptance of owner verification,
semantic turn-taking, or real phone conversation quality.
"""
import argparse
import json
import subprocess
import re
import wave
from pathlib import Path
import numpy as np
import onnxruntime as ort
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument("--adb", required=True)
parser.add_argument("--serial", default="emulator-5554")
parser.add_argument("--probe", type=Path, required=True)
parser.add_argument("--resources", type=Path, required=True)
parser.add_argument("--fixtures", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--closed-loop", action="store_true", help="Also test render removal at an acoustic candidate; not an authorized Agent interruption")
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
remote = "/data/local/tmp/black-echo-" + re.sub(r"[^A-Za-z0-9_-]", "-", args.output.name)

def adb(*values):
    return subprocess.run([args.adb, "-s", args.serial, *map(str, values)], check=True, capture_output=True, text=True).stdout

adb("shell", "mkdir", "-p", remote)
adb("push", args.probe, remote + "/probe")
library = args.probe.parent / "libblack-echo.so"
if library.exists(): adb("push", library, remote + "/libblack-echo.so")
adb("shell", "chmod", "700", remote + "/probe")

def samples(path):
    with wave.open(str(path), "rb") as source:
        assert source.getnchannels() == 1 and source.getsampwidth() == 2
        rate = source.getframerate()
        values = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float32) / 32768
    return np.interp(np.arange(round(len(values) * 16000 / rate)) * rate / 16000, np.arange(len(values)), values).astype(np.float32)

opts = ort.SessionOptions(); opts.intra_op_num_threads = 1; opts.inter_op_num_threads = 1
session = ort.InferenceSession(str(args.resources / "vad/silero_vad.onnx"), sess_options=opts, providers=["CPUExecutionProvider"])
print("Pinned VAD input schema:", [(item.name, item.shape) for item in session.get_inputs()], flush=True)

def probability(values):
    inputs = {item.name: item for item in session.get_inputs()}
    v5 = "state" in inputs
    state = {"state": np.zeros((2, 1, 128), dtype=np.float32)} if v5 else {"h": np.zeros((2, 1, 64), dtype=np.float32), "c": np.zeros((2, 1, 64), dtype=np.float32)}
    context = np.zeros(64, dtype=np.float32)
    probabilities = []
    for offset in range(0, len(values), 512):
        block = values[offset:offset + 512]
        if len(block) < 512: block = np.pad(block, (0, 512 - len(block)))
        audio = np.concatenate([context, block]) if v5 else block
        audio_name = "input" if "input" in inputs else "x"
        feed = {**state, audio_name: audio.reshape(1, -1)}
        if "sr" in inputs: feed["sr"] = np.array(16000, dtype=np.int64)
        output = session.run(None, feed)
        # Same onset evidence as VoiceAudioEngine: recurrent VAD tail is not a
        # new microphone source in an acoustically zeroed frame.
        probabilities.append(float(output[0].reshape(-1)[0]) if np.any(block) else 0.)
        if v5: state["state"] = output[1]; context = block[-64:]
        else: state["h"], state["c"] = output[1], output[2]
    return np.asarray(probabilities)

def speech_starts(values):
    probs = probability(values); streak = 0; starts = []
    for index, prob in enumerate(probs):
        streak = streak + 1 if prob >= .55 else 0
        if streak == 5: starts.append(index * .032)
    return starts, float(max(probs, default=0))

def process(name, rendered, captured):
    count = ((max(len(rendered), len(captured)) + 511) // 512) * 512
    for suffix, values in [("far", rendered), ("mic", captured)]:
        pcm = (np.clip(np.pad(values, (0, count - len(values))), -1, 1) * 32767).astype("<i2")
        file = args.output / f"{name}-{suffix}.pcm"; pcm.tofile(file); adb("push", file, f"{remote}/{name}-{suffix}.pcm")
    timing = adb("shell", "env", f"LD_LIBRARY_PATH={remote}", remote + "/probe", f"{remote}/{name}-far.pcm", f"{remote}/{name}-mic.pcm", f"{remote}/{name}-out.pcm")
    print(name, timing.strip(), flush=True)
    metrics = dict(re.findall(r"(dsp_cpu_ms|audio_ms)=([0-9.]+)", timing))
    if metrics:
        assert float(metrics["dsp_cpu_ms"]) < float(metrics["audio_ms"]) * .5, "AEC CPU is not safely faster than real time; do not ship a backlog-prone implementation"
    output = args.output / f"{name}-out.pcm"; adb("pull", f"{remote}/{name}-out.pcm", output)
    return np.fromfile(output, dtype="<i2").astype(np.float32) / 32768

def echo(rendered, delay, gain=.45):
    result = np.zeros(len(rendered), dtype=np.float32)
    for seconds, scale in [(delay, gain), (delay + .027, gain * .19), (delay + .067, gain * .08)]:
        offset = round(seconds * 16000)
        result[offset:] += rendered[:len(rendered) - offset] * scale
    return result

assistant = samples(args.fixtures / "assistant.wav")
# A short playback fixture, not a shipped or hardcoded wake acknowledgement.
cue = assistant[:12000]
reports = []; failures = []
for delay in [.0, .02, .08, .16]:
    far = np.pad(cue, (6400, 32000)); mic = echo(far, delay)
    cleaned = process(f"cue-{round(delay * 1000)}", far, mic)
    starts, peak = speech_starts(cleaned)
    reports.append({"case": f"own-cue-{delay}", "falseSpeechStarts": starts, "maxSpeechProbability": round(peak, 4)})
    if starts: failures.append(reports[-1])

far = np.pad(assistant, (6400, 32000))
room = echo(far, .08)
shift = len(room) // 2
gain_change = room.copy(); gain_change[shift:] *= .4
delay_change = room.copy(); delay_change[shift:] = echo(far, .18)[shift:]
# Loudspeaker distortion, longer acoustic paths and route changes were absent from the old tests.
for name, mic in [("own-long-reply", room), ("own-reply-noise", room + np.random.default_rng(15).normal(0, .0006, len(far))),
                  ("own-speaker-compression", np.tanh(room * 5) / 5),
                  ("own-speaker-clipping", np.clip(room, -.07, .07)),
                  ("own-gain-change", gain_change), ("own-delay-change", delay_change),
                  ("own-long-delay", echo(far, .32))]:
    cleaned = process(name, far, mic); starts, peak = speech_starts(cleaned)
    reports.append({"case": name, "falseSpeechStarts": starts, "maxSpeechProbability": round(peak, 4)})
    if starts: failures.append(reports[-1])

for user_file, near_gain in [("user.wav", .65), ("user-same-voice.wav", .65), ("user.wav", .25), ("user-same-voice.wav", .25)]:
    user = samples(args.fixtures / user_file)
    far = np.pad(assistant, (6400, 32000)); at = 24000
    # Test overlapping real speech, not a keyword or an energy-only beep.
    mic = echo(far, .08); mic[at:at + len(user)] += user * near_gain
    cleaned = process(user_file.replace(".wav", "") + str(round(near_gain * 100)), far, mic)
    starts, peak = speech_starts(cleaned)
    real_starts = [start for start in starts if start >= at / 16000]
    detection = real_starts[0] if real_starts else None
    asr = sherpa_onnx.OnlineRecognizer.from_zipformer2_ctc(model=str(args.resources / "asr/model.int8.onnx"), tokens=str(args.resources / "asr/tokens.txt"), num_threads=2)
    stream = asr.create_stream()
    if detection is not None:
        begin = max(0, round((detection - .5) * 16000))
        stream.accept_waveform(16000, cleaned[begin:at + len(user) + 16000]); stream.input_finished()
        while asr.is_ready(stream): asr.decode_stream(stream)
    text = asr.get_result(stream)
    report = {"case": user_file, "nearGain": near_gain, "speechStarts": starts, "detectedAfterUserStartMs": round((detection - at / 16000) * 1000) if detection else None, "transcript": text}
    reports.append(report)
    if detection is None or detection - at / 16000 > 1.0 or any(start < at / 16000 for start in starts) or not text:
        failures.append(report)
    if args.closed_loop and detection is not None:
        # Model only a candidate pause in the acoustic front-end. Production
        # now verifies the owner first, retains PCM, and needs a semantic
        # decision before cancelling a turn. Keep the already-rendered tail.
        stopped_far = far.copy(); stopped_far[round((detection + .032) * 16000):] = 0
        stopped_mic = echo(stopped_far, .08); stopped_mic[at:at + len(user)] += user * near_gain
        stopped = process("stopped-" + user_file.replace(".wav", "") + str(round(near_gain * 100)), stopped_far, stopped_mic)
        recognizer = sherpa_onnx.OnlineRecognizer.from_zipformer2_ctc(model=str(args.resources / "asr/model.int8.onnx"), tokens=str(args.resources / "asr/tokens.txt"), num_threads=2)
        target = recognizer.create_stream(); target.accept_waveform(16000, stopped[begin:at + len(user) + 16000]); target.input_finished()
        while recognizer.is_ready(target): recognizer.decode_stream(target)
        recognized = recognizer.get_result(target)
        after, _ = speech_starts(stopped)
        report = {"case": "closed-loop-" + user_file, "nearGain": near_gain, "transcript": recognized, "afterUserFinishedSpeechStarts": [t for t in after if t > (at + len(user)) / 16000 + .5]}
        reports.append(report)
        if not recognized or report["afterUserFinishedSpeechStarts"]: failures.append(report)

# No words are blacklisted; the same speech is legitimate when no assistant render exists.
near = np.pad(cue, (6400, 32000)); cleaned = process("real-cue-words-no-render", np.zeros(len(near)), near)
starts, peak = speech_starts(cleaned); reports.append({"case": "real-cue-words-no-render", "speechStarts": starts})
if not starts: failures.append(reports[-1])

(args.output / "result.json").write_text(json.dumps({"reports": reports, "failures": failures}, ensure_ascii=False, indent=2), encoding="utf8")
for report in reports: print(json.dumps(report, ensure_ascii=False), flush=True)
assert not failures, "Acoustic echo/onset regression failed; see result.json, do not claim phone acceptance."
