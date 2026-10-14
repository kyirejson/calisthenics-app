"""Offline engine verification using synthetic wake audio and upstream ASR fixtures.
This is not microphone/ColorOS hardware verification; no user audio is captured.
"""
import argparse
import wave
from pathlib import Path
import numpy as np
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument("--resources", type=Path, required=True)
parser.add_argument("--fixtures", type=Path, required=True)
parser.add_argument("--asr-fixture", type=Path, required=True)
args = parser.parse_args()

def samples(path):
    with wave.open(str(path), "rb") as audio:
        if audio.getsampwidth() != 2 or audio.getnchannels() != 1:
            raise ValueError("Expected mono PCM16 fixture")
        rate = audio.getframerate()
        values = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2").astype(np.float32) / 32768
    if rate != 16000:
        values = np.interp(np.arange(round(len(values) * 16000 / rate)) * rate / 16000, np.arange(len(values)), values).astype(np.float32)
    return np.concatenate((values, np.zeros(16000, dtype=np.float32)))

kws = sherpa_onnx.KeywordSpotter(tokens=str(args.resources / "kws/tokens.txt"), encoder=str(args.resources / "kws/encoder.onnx"), decoder=str(args.resources / "kws/decoder.onnx"), joiner=str(args.resources / "kws/joiner.onnx"), keywords_file=str(args.resources / "keywords.txt"), keywords_threshold=0.5, num_trailing_blanks=1, num_threads=1)
for name in ["black", "hey-black", "negative"]:
    stream = kws.create_stream()
    detected = []
    values = samples(args.fixtures / (name + ".wav"))
    for start in range(0, len(values), 1600):
        stream.accept_waveform(16000, values[start:start + 1600])
        while kws.is_ready(stream):
            kws.decode_stream(stream)
            result = kws.get_result(stream)
            if result:
                detected.append(result)
                kws.reset_stream(stream)
    if name == "negative":
        assert not detected, detected
    else:
        assert any("BLACK" in item for item in detected), (name, detected)
    print(name, "detected:", detected, flush=True)

asr = sherpa_onnx.OnlineRecognizer.from_zipformer2_ctc(model=str(args.resources / "asr/model.int8.onnx"), tokens=str(args.resources / "asr/tokens.txt"), num_threads=2)
stream = asr.create_stream()
stream.accept_waveform(16000, samples(args.asr_fixture))
stream.input_finished()
while asr.is_ready(stream):
    asr.decode_stream(stream)
text = asr.get_result(stream)
assert "研究" in text and "兴趣" in text, text
print("Upstream Chinese ASR fixture transcribed:", text)
