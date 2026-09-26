# Single-leg calf demonstration

Superseded display asset: this diptych is now an edit source only. See `SINGLE-DEMO-V2.md` for the standalone, single-person image currently used in the app.

- Asset: `single-leg-calf-shoes-v1.png`
- Built-in image generation and edit tools, 2026-09-26; no CLI.
- Photorealistic fictional demonstrator, not an original-book photograph. No image badge at the user's request; provenance remains here and in the exercise source.
- Final output: `C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-cf48e7df-96be-4d5c-b23f-bb57a7dc5c51.png`.
- Initial barefoot draft was rejected; only the shoe version is referenced by the project.

## Generation prompt

Use case: scientific-educational. Asset: photo-realistic single-leg calf raise demonstration for a mobile fitness app. Create a clean two-panel horizontal diptych, same fictional adult male athlete in both panels, gray fitted T-shirt and black above-knee shorts, barefoot. Neutral off-white studio wall, matte level floor, soft natural lighting, realistic skin and fabric, no cartoon or 3D rendering. Full body entirely visible with generous margins around head and feet. Side profile facing right, fingertips lightly touching the wall for balance, upright trunk, working leg straight without hyperextension, other knee bent so the free foot stays visibly off the floor behind him. LEFT: start with working heel and forefoot flat on level floor. RIGHT: same supporting leg, heel lifted visibly 5-8 cm, toes and ball of foot firmly on floor, ankle aligned and upright, knee and trunk position unchanged. Clearly show the raised heel and floor gap in right panel; no step or platform, no weights, no jumps, no second foot contact. Two natural arms, two natural legs, anatomically plausible feet and five toes, identical camera and scale. Thin subtle separator only. No text, no labels, no AI badge, no logos, no watermark. This is a fictional photographic-style demonstration, not a reproduction of a book photo.

## Final edit prompt

Edit this exercise diptych: replace ONLY all bare feet with realistic plain low-top training sneakers with thin flexible nonslip soles, neutral white/light-gray color, no brand logos. Shoes on both feet in both panels. Preserve the same man, clothing, lighting, camera, background, full-body framing and two exercise positions exactly. Left supporting shoe entire sole flat on floor. Right supporting shoe forefoot/toe section on floor, shoe heel raised with a clearly visible floor gap, flexible sole bends naturally at ball of foot. Free foot remains off floor behind him. Do not add words, labels or badges. Do not change anatomy or pose.

## Implementation

The new `aux_singleLegCalf` floor variant replaces automatic calf slots. The old double-leg and step-raise IDs remain available for existing history and the original library, not silently relabelled. Application dose: 2 sets of 20 total repetitions, 10 per side, 60 seconds between sets. Estimated work uses total repetitions, so both sides are included. Original CC2 stage 4 source is shown separately from the application dose.
