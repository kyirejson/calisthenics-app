"""Generate the local '我在' cue using the same pinned, licensed build-only voice.
No network call or TTS initialization is needed when BLACK wakes.
"""
import argparse
import hashlib
import json
import wave
from pathlib import Path
import importlib.util
import numpy as np

spec = importlib.util.spec_from_file_location("running_voice_builder", Path(__file__).with_name("build-running-voices.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

parser = argparse.ArgumentParser()
parser.add_argument("--model-dir", type=Path, required=True)
parser.add_argument("--checkpoint", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / "modules/uncover-voice/android/src/main/assets/black-voice"
root.mkdir(parents=True, exist_ok=True)
checkpoint = args.checkpoint or args.model_dir / "kokoro-v1_1-zh.pth"
if hashlib.sha256(checkpoint.read_bytes()).hexdigest() != builder.MODEL_HASH:
    raise ValueError("Unexpected model digest")
builder.torch.set_num_threads(4)
model = builder.KModel(repo_id=builder.REPO, config=str(args.model_dir / "config.json"), model=str(checkpoint)).to("cpu").eval()
pipeline = builder.KPipeline(lang_code="z", repo_id=builder.REPO, model=model)
audio = np.concatenate([result.audio.numpy() for result in pipeline("我在。", voice=str(args.model_dir / "voices/zf_001.pt"), speed=1.12)])
block = builder.pcm(audio)
with wave.open(str(root / "iam.wav"), "wb") as output:
    output.setnchannels(1); output.setsampwidth(2); output.setframerate(builder.RATE); output.writeframes(block.tobytes())
(root / "iam-provenance.json").write_text(json.dumps({"text": "我在。", "model": builder.REPO, "revision": builder.REVISION, "modelSha256": builder.MODEL_HASH, "voice": "zf_001", "license": "Apache-2.0", "sha256": hashlib.sha256((root / "iam.wav").read_bytes()).hexdigest()}, indent=2), encoding="utf-8")
print("Local acknowledgement generated:", len(block) / builder.RATE, "seconds")
