# Offline running announcement voices

Two distinct synthetic Mandarin speakers: female `zf_001`, male `zm_010`.
Generated locally with Kokoro 0.9.4 and Misaki 0.9.4 from
[hexgrad/Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh),
pinned revision `01e7505bd6a7a2ac4975463114c3a7650a9f7218`.
Upstream model card declares Apache-2.0 and attributes the Chinese training data
to LongMaoData. The complete Apache-2.0 license is included as `LICENSE.txt`.
The manifest records the verified upstream checkpoint/speaker hashes and each
generated PCM pack's hash. These are generated voices, not human recordings.

This project's generation script trims silence, levels each clip, applies a
5ms edge fade and packs mono 24kHz/16-bit PCM in WAV. It does not pitch-shift a
single voice to imitate male/female speakers. Numbers and fixed phrases are
assembled locally; no account, cloud API or network is needed on Android.
The model weights and build-only Python dependencies are **not** shipped.

Rebuild: `python scripts/build-running-voices.py` in the repository root with
the build-only dependencies listed in that script. Local downloads may be
provided with `--model-dir`/`--checkpoint`; the checkpoint hash is still checked.
Android and web share these same packs. The web-only asset imports are isolated
by Metro's `.web.ts` resolution to avoid duplicating the WAVs in native bundles.

Audio quality is not proven by unit tests. Verify on actual phone speakers or
headphones before making device-specific audible quality claims.
