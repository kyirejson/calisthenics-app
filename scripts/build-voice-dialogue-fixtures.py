"""Synthetic, build-only near/far audio for barge-in acceptance. Never records a microphone."""
import argparse
import importlib.util
import hashlib
import wave
from pathlib import Path
import numpy as np

spec = importlib.util.spec_from_file_location("voice_builder", Path(__file__).with_name("build-running-voices.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
parser = argparse.ArgumentParser()
parser.add_argument("--model-dir", type=Path, required=True)
parser.add_argument("--checkpoint", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
if hashlib.sha256(args.checkpoint.read_bytes()).hexdigest() != builder.MODEL_HASH:
    raise ValueError("Unexpected voice model digest")
args.output.mkdir(parents=True, exist_ok=True)
builder.torch.set_num_threads(4)
model = builder.KModel(repo_id=builder.REPO, config=str(args.model_dir / "config.json"), model=str(args.checkpoint)).to("cpu").eval()
pipeline = builder.KPipeline(lang_code="z", repo_id=builder.REPO, model=model)
for name, text, voice in [
    ("assistant", "已经为你记录了早餐。今天可以先做深蹲，然后休息，再练俯卧撑。需要的话我可以继续讲解动作。", "zf_001"),
    ("user", "换一首轻快一点的歌。", "zm_010"),
    ("user-same-voice", "不用解释了，下一首。", "zf_001"),
]:
    audio = np.concatenate([result.audio.numpy() for result in pipeline(text, voice=str(args.model_dir / f"voices/{voice}.pt"), speed=1.12)])
    with wave.open(str(args.output / f"{name}.wav"), "wb") as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(builder.RATE); output.writeframes(builder.pcm(audio).tobytes())
    print(name, "synthetic fixture seconds:", round(len(audio) / builder.RATE, 2), flush=True)
