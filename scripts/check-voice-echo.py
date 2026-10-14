"""Test the production echo_core.c on an owned Android emulator with generated audio.
No device microphone, live API, private user data, or production test hooks are used.
"""
import argparse
import json
import subprocess
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
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
remote = "/data/local/tmp/black-echo-fixtures-20261014"

def adb(*values):
    return subprocess.run([args.adb, "-s", args.serial, *map(str, values)], check=True, capture_output=True, text=True).stdout

adb("shell", "mkdir", "-p", remote)
adb("push", args.probe, remote + "/probe")
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
        probabilities.append(float(output[0].reshape(-1)[0]))
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
    adb("shell", remote + "/probe", f"{remote}/{name}-far.pcm", f"{remote}/{name}-mic.pcm", f"{remote}/{name}-out.pcm")
    output = args.output / f"{name}-out.pcm"; adb("pull", f"{remote}/{name}-out.pcm", output)
    return np.fromfile(output, dtype="<i2").astype(np.float32) / 32768

def echo(rendered, delay, gain=.45):
    result = np.zeros(len(rendered), dtype=np.float32)
    for seconds, scale in [(delay, gain), (delay + .027, gain * .19), (delay + .067, gain * .08)]:
        offset = round(seconds * 16000)
        result[offset:] += rendered[:len(rendered) - offset] * scale
    return result

cue = samples(args.resources / "iam.wav")
reports = []; failures = []
for delay in [.0, .02, .08, .16]:
    far = np.pad(cue, (6400, 32000)); mic = echo(far, delay)
    cleaned = process(f"cue-{round(delay * 1000)}", far, mic)
    starts, peak = speech_starts(cleaned)
    reports.append({"case": f"own-cue-{delay}", "falseSpeechStarts": starts, "maxSpeechProbability": round(peak, 4)})
    if starts: failures.append(reports[-1])

assistant = samples(args.fixtures / "assistant.wav")
far = np.pad(assistant, (6400, 32000))
for name, mic in [("own-long-reply", echo(far, .08)), ("own-reply-noise", echo(far, .08) + np.random.default_rng(15).normal(0, .0006, len(far)))]:
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

# The legitimate words "我在" are not blacklisted; acoustic ownership alone distinguishes playback echo.
near = np.pad(cue, (6400, 32000)); cleaned = process("real-cue-words-no-render", np.zeros(len(near)), near)
starts, peak = speech_starts(cleaned); reports.append({"case": "real-cue-words-no-render", "speechStarts": starts})
if not starts: failures.append(reports[-1])

(args.output / "result.json").write_text(json.dumps({"reports": reports, "failures": failures}, ensure_ascii=False, indent=2), encoding="utf8")
for report in reports: print(json.dumps(report, ensure_ascii=False), flush=True)
assert not failures, "Echo/barge-in acceptance failed; see result.json, do not claim phone acceptance."
