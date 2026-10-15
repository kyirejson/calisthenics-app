"""Run the actual bundled local model; desktop measurements are not phone acceptance."""
import argparse
import hashlib
import json
import time
import sys
from pathlib import Path
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument('--resources', type=Path, required=True)
args = parser.parse_args()
p = args.resources.resolve()
if sys.platform == 'win32' and not str(p).isascii():
    raise SystemExit('Windows native FST readers require an ASCII-path resource snapshot; pass --resources with that snapshot.')
config = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(
            model=str(p / 'model.onnx'), tokens=str(p / 'tokens.txt'),
            lexicon=str(p / 'lexicon.txt'), data_dir=''), num_threads=2),
    rule_fsts=','.join(str(p / (name + '.fst')) for name in ['phone', 'date', 'number']))
began = time.monotonic()
engine = sherpa_onnx.OfflineTts(config)
result = {'modelSha256': hashlib.sha256((p / 'model.onnx').read_bytes()).hexdigest(),
          'loadSeconds': time.monotonic() - began, 'engine': sherpa_onnx.__version__, 'cases': []}
for text in ['我在。', '今天已经跑了三公里，用时二十分钟。', '这是第一句。接下来是第二句。最后一句也需要完整播放。']:
    began = time.monotonic()
    audio = engine.generate(text)
    seconds = time.monotonic() - began
    assert len(audio.samples) > 5000 and audio.sample_rate == 44100
    assert any(abs(float(value)) > .001 for value in audio.samples)
    duration = len(audio.samples) / audio.sample_rate
    result['cases'].append({'characters': len(text), 'synthesisSeconds': seconds,
                            'audioSeconds': duration, 'rtf': seconds / duration})
print(json.dumps(result, ensure_ascii=False, indent=2))
