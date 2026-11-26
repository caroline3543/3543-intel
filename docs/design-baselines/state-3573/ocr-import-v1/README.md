# Stage 9 design lock v1.0
Owner-approved interaction direction. Reconstructed visual assets are not yet owner-approved browser snapshots.

## Install exact reference assets
Extract the original Stage9_Design_Lock_Pack.zip. Copy its eight PNGs into reference-screens/ and its PDF into this directory. Do not replace the committed Markdown documents with older ZIP copies. Run from this directory:
```sh
sha256sum -c SHA256SUMS
```
All nine files must pass. Missing assets block visual signoff. The manifest fingerprints the ZIP version, not a separately generated PDF.

## Release gates
1. Verify reference integrity.
2. Read DESIGN_CONTRACT.md and QA_PROMPT.md.
3. Capture actual browser states using isolated fixtures; compare all eight states against references.
4. Obtain owner approval for first browser captures, then commit immutable snapshots and Playwright tests.
5. Run functional F01–F12 and visual comparisons; archive actual/expected/diff and test results.
6. Do not promote production with missing evidence or failing mandatory checks.
Never regenerate expected images to conceal drift. Changes to baseline require owner approval and version bump.

Current status: reference hashes and text contract committed; binary assets and browser snapshots pending. No visual or functional test pass is claimed.
