"""Build small, offline announcement packs; no TTS model or Python ships in the APK.

Build-only dependencies: kokoro==0.9.4, misaki[zh]==0.9.4, soundfile, torch.
Chinese model: hexgrad/Kokoro-82M-v1.1-zh (Apache-2.0).
Generated PCM is trimmed/faded/levelled by this project, not pitch-shifted.
"""
import argparse
import hashlib
import json
import wave
from importlib.metadata import distribution
from pathlib import Path

import numpy as np
import torch
from huggingface_hub import hf_hub_download
from kokoro import KModel, KPipeline

REPO = "hexgrad/Kokoro-82M-v1.1-zh"
REVISION = "01e7505bd6a7a2ac4975463114c3a7650a9f7218"
MODEL_HASH = "b1d8410fa44dfb5c15471fd6c4225ea6b4e9ac7fa03c98e8bea47a9928476e2b"
RATE = 24000
VOICES = {"female": "zf_001", "male": "zm_010"}
PHRASES = {
    "start": "开始跑步。", "resume": "继续跑步。", "pause": "跑步已暂停。",
    "auto_pause": "已自动暂停，重新跑动后继续。", "auto_resume": "已自动继续跑步。",
    "distance": "您已跑了", "estimated": "计步估算，您已跑了", "partial": "已记录定位路段",
    "km_time": "公里，用时", "minutes": "分钟", "minute": "分", "seconds": "秒",
    "hundred": "百", "thousand": "千", "ten_thousand": "万", "hundred_million": "亿",
}


def chinese(n):
    digits = "零一二三四五六七八九"
    if n < 10:
        return digits[n]
    return (digits[n // 10] if n >= 20 else "") + "十" + (digits[n % 10] if n % 10 else "")


def pcm(audio):
    # Keep 25ms edge padding, remove generated long silence, avoid splice clicks.
    active = np.flatnonzero(np.abs(audio) > .006)
    if not len(active):
        raise ValueError("Synthesizer returned silence")
    pad = RATE // 40
    audio = audio[max(0, active[0] - pad):min(len(audio), active[-1] + pad + 1)].copy()
    peak = np.max(np.abs(audio))
    audio *= min(2.0, .86 / peak)
    fade = min(RATE // 200, len(audio) // 2)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    return (np.clip(audio, -1, 1) * 32767).astype("<i2")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "modules/uncover-running/android/src/main/assets/run-voices")
    parser.add_argument("--model-dir", type=Path, help="Optional pre-downloaded upstream model/config/voices/LICENSE")
    parser.add_argument("--checkpoint", type=Path, help="Optional verified upstream checkpoint path")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(4)
    torch.manual_seed(14)
    revision = REVISION
    def upstream(filename):
        return str(args.model_dir / filename) if args.model_dir else hf_hub_download(REPO, filename, revision=revision)
    print("Download/verify weights", revision, flush=True)
    checkpoint = str(args.checkpoint) if args.checkpoint else upstream("kokoro-v1_1-zh.pth")
    if hashlib.sha256(Path(checkpoint).read_bytes()).hexdigest() != MODEL_HASH:
        raise ValueError("Unexpected upstream model digest")
    config = upstream("config.json")
    model = KModel(repo_id=REPO, config=config, model=checkpoint).to("cpu").eval()
    pipeline = KPipeline(lang_code="z", repo_id=REPO, model=model)
    print("Chinese synthesizer ready", flush=True)
    phrases = {**PHRASES, **{f"n{i}": chinese(i) for i in range(100)}}
    manifest = {"version": 1, "sampleRate": RATE, "channels": 1, "sampleWidth": 2,
                "model": REPO, "revision": revision, "modelSha256": MODEL_HASH, "license": "Apache-2.0", "voices": {}}
    for style, voice in VOICES.items():
        voice_path = upstream(f"voices/{voice}.pt")
        clips, blocks, frame = {}, [], 0
        for index, (key, text) in enumerate(phrases.items()):
            audio = np.concatenate([result.audio.numpy() for result in pipeline(text, voice=voice_path, speed=1.05)])
            block = pcm(audio)
            clips[key] = {"start": frame, "length": len(block), "text": text}
            blocks.append(block)
            frame += len(block)
            if index % 20 == 0:
                print(style, index, "of", len(phrases), flush=True)
        target = args.output / f"{style}.wav"
        with wave.open(str(target), "wb") as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(RATE)
            wav.writeframes(np.concatenate(blocks).tobytes())
        manifest["voices"][style] = {"speaker": voice, "speakerSha256": hashlib.sha256(Path(voice_path).read_bytes()).hexdigest(),
                                      "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "frames": frame, "clips": clips}
        print(style, "complete:", target.stat().st_size, "bytes", flush=True)
    # Upstream model card declares Apache-2.0 but does not include a LICENSE file.
    license_path = str(args.model_dir / "LICENSE") if args.model_dir else str(distribution("kokoro").locate_file("kokoro-0.9.4.dist-info/licenses/LICENSE"))
    (args.output / "LICENSE.txt").write_bytes(Path(license_path).read_bytes())
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
