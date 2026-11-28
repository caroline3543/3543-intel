# State 3573 Caroline preview engineering

## Baseline

- Starting development HEAD: `b2eaae277a8a2924586cab47a07f5452b68b3ef6`. Inspected the Stage 9 contract, compact revision and the six reference files at `8767d7163009fd5d5b28b6684a8bcb0e14be85ac`.
- Prior baseline CI for the labelled HOT fixture: [real-image OCR](https://github.com/caroline3543/3543-intel/actions/runs/46111406689). The two-worker result had 85 correct automatic matches, zero incorrect automatic matches and 15 manual reviews across 100 labelled readings against a label-derived roster. That evidence does not establish RKG identity accuracy or cross-matcher review reduction.
- Retrieved all 19 original RKG Canyon Clash captures privately. No user-provided screenshots or private roster data belong in this repository.

## Candidate changes and executed checks

- Foundry and Canyon Clash share the existing matcher, planner validator and save receipt for pasted lists and screenshots. Compact review starts with all readings. Ambiguous FIDs, candidate changes, suspicious powers and registration exceptions remain explicit.
- The squad planner supports 2–6 teams, optional distinct leaders, protected moves, locks, and copy. The preview branch rejects production-shaped workspace credentials. Preview browser tests use sample data.
- Local Chromium mobile workflows passed with sample data at 320, 390 and 428 CSS px. Existing browser review and event planner suites passed. Unit suite passed with 598 tests after reconciling the concurrent paste implementation. The isolated browser alias suite tested create, reuse, edit, delete, failed save and retry against a simulated backend. The GitHub local-Supabase workflow exercises the same paths with a disposable database.
- Twenty runs per scenario on Node 24.22.3, Linux x64, AMD EPYC 9V74. For 40 pasted rows against 1,000 synthetic players, cold matching p95 was 72.8 ms for exact names and 86.5 ms when all rows needed suggestions. Local five-row browser click-to-visible measurements ranged from 54 to 125 ms and included browser automation time.
- Raw integrated OCR on the 19 original RKG files with two workers and name retries disabled took 16.8 s after 2.2 s worker startup. It yielded 59 complete readings and 19 partial detections before overlap handling. These are extraction diagnostics with no ground truth.

## Exploratory RKG comparison

The 19 original RKG screenshots contain 76 visually readable rows. A multimodal transcription was compared with two user-provided historical RKG exports and the State 3573 roster export. Thirty-four rows had a unique normalised identity with a consistent permanent ID available for scoring. The labels are a partial roster corroboration and the transcription and row coverage were checked in the same review pass. This comparison cannot certify the independent release gate.

| Pipeline | Rows available | Correct automatic IDs of 34 | Wrong automatic IDs of 34 | Review or missing of 34 | Parsing | Matching |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A · Integrated OCR, prior 3573 matcher | 59 | 19 | 0 | 15 | Screenshot recognition 16.8 s | 85.6 ms |
| B · Multimodal text, original 3543 | 76 | 31 | 0 | 3 | 0.4 ms | 30.6 ms |
| C · Same text, candidate 3573 | 76 | 31 | 0 | 3 | 3.0 ms | 27.4 ms |
| D · Roster-corroborated canonical names and FIDs, candidate 3573 | 34 | 32 | 0 | 2 | Not timed | 2.1 ms |

- A returned 17 fewer rows than visible on manual inspection. 57 detected row powers agreed with the visual transcript. The partial detections show the OCR capture limitation remains. B and C retained the 76 powers from the input transcript. C retained per-row registration text. B's original name/power input has no per-row registration field.
- B also returned two automatic matches outside the corroborated subset. Their correctness is unverified. Two D rows required review because roster eligibility remains enforced.
- Meli is directly corroborated across independent roster exports. The available records do not connect Meli to Black Lotus, JAGUAR to JAGPOLEON, or IscoHatesMyName to Isco22. The Jessie Reyes and Mr Tang cases belong to the 3543 reference screenshots, and the RKG exports do not establish their permanent IDs. No aliases were learned from the evaluation images.

## Gates and handoff

| Requirement | State | Evidence or dependency |
| --- | --- | --- |
| Foundry and Canyon paste workflow, shared review, squad balancing | Passed locally | Browser and unit suites on synthetic data |
| Existing OCR image upload and review | Review passed locally | Separate upload browser and exact-commit CI results must be checked |
| Matching under 250 ms for 40 rows and 1,000 players | Passed locally | `node tests/3573-paste-performance.mjs` |
| Independently verified RKG identity and transcription accuracy, four-way comparison, 30% fewer reviews | Blocked | The partial comparison above covers 34 of 76 readable rows. Requires independently verified image-to-FID labels and independent checking for the remaining rows and metric claims. |
| Five-minute real operator workflow | Not verified | Requires a timed operator journey on a real labelled roster |
| Authenticated persistence and hosted preview | Pending exact-commit evidence | Check the local-Supabase CI workflow and the isolated hosted fixture |

To roll back a preview, reopen the previous immutable Vercel preview URL, or redeploy the previous tested SHA with the preview target. Revert the development commits if the branch needs to return to the prior build. No schema migration is needed. Avoid Vercel production promotion, production rollback and production alias changes.
