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

## Hosted candidate checkpoint

- Vercel preview `dpl_6b7XQ4USzJEvbuF7Ac9oxbKVD52J` deployed `319f430b2013cd69407aba099390870c3089ee81` to the separate demo project. [Open the sample roster](https://3573-caroline-demo-1lyldijx1-sunfire-castle-planner.vercel.app/event-preview.html). The exact candidate passed 600 tests, the build, hosted paste and squad checks at all three mobile widths, grouped TSV/pipe regression checks, and hosted real screenshot upload and review. Its workspace API returned HTTP 401.
- [Disposable Supabase CI for the deployed commit](https://github.com/caroline3543/3543-intel/actions/runs/46114536482) passed browser persistence with create, failed save and retry, reuse, edit and deletion.
- The previous hosted PR workflow [failed on an older fixed demo URL](https://github.com/caroline3543/3543-intel/actions/runs/46114539402). The follow-up workflow builds and tests the exact PR head locally. An explicit hosted run checks the supplied immutable preview's fixture assets and workspace access before exercising the hosted journey. Verify the deployment SHA in Vercel before supplying that URL and SHA. That follow-up changes CI and this log only.

## Canyon Clash commander roster coverage

The Legion Commander panel pushes the list and registration totals down. The checkbox layout's scan boundary truncated the fourth readable row in 17 of 19 original RKG screenshots. The reader now selects the list bounds and totals crop from the detected layout. Username retry uses the same list geometry. Regions without enough visible card height stay flagged as partial.

| Measure on the 19 original RKG images | Previous | Layout-aware reader |
| --- | ---: | ---: |
| Readable rows detected (76 visually transcribed) | 59 | 76 |
| Troop powers agreeing with visual transcription | 57 | 76 |
| Extra complete rows | 0 | 0 |
| Screenshots with both totals read correctly | 0 | 19 |
| Two-worker recognition time, retries disabled | 16.8 s | 18.5 s |

The row benchmark pairs OCR output with the earlier visual transcript by vertical position. It measures extraction and power coverage. It does not establish verified player identities or per-player registration accuracy. The obscured legion heading on one screenshot still requires manual legion selection. Unrecognised registration controls still require review. No private screenshot or player data was added to Git.

## Commander roster registration labels

The commander layout uses text labels in the right column. The reader crops below the voting badge and recognises complete English labels for Join, Substitute and No engagements. Dispatch evidence takes precedence, and unfamiliar or unreadable labels stay unknown. The older checkbox reader and the importer's existing identity, capacity and move checks are unchanged.

On the 19 original RKG screenshots, all 76 row powers and all 76 registration statuses agreed with the visual transcript. The statuses were 28 combatants, 7 substitutes, 17 unassigned and 24 dispatched to Legion 2. The earlier layout-only change recognised 24 of the 76 statuses. OCR still identified 18 of the 19 legion headings, and the obscured heading requires an explicit destination selection. This verifies visible fields on this capture set. It does not independently verify player identity or translated labels.

## RKG identity gate against the near-capture roster

Evaluated candidate `85809ae7479512889d7e4225b1e17e41e7e971a2` against the 19 original RKG screenshots. The 76 image rows were linked to permanent IDs using a read-only workspace identity extract at revision 6306, historical roster exports, nickname and rename history, and direct screenshot checks. Visual avatar evidence disambiguated reused names where the avatars differed. The comparison held the active roster input constant at 659 records, used an empty event registration context and excluded learned OCR aliases from both matchers. No production records were edited. Private fixtures and row-level results remain outside Git.

| Pipeline | Rows read | Correct automatic IDs | Wrong automatic IDs | Manual identity reviews | Missing rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original OCR and matcher | 59 | 40 | 0 | 19 | 17 |
| Candidate screenshot OCR and matcher | 76 | 51 | 0 | 25 | 0 |
| Candidate paste using visually checked four-column text | 76 | 61 | 0 | 15 | 0 |

On the same 59 rows covered by the original OCR, the screenshot candidate still required 19 manual reviews. The paste workflow required 12, a 36.8% reduction on that common set. The recovered 17 rows added six manual reviews to the screenshot workflow. Missing rows plus manual identity reviews decreased from 36 to 25, a 30.6% reduction in total exceptions. That combined measure is separate from the 30% manual-review release target.

- Observed automatic identity accuracy **passed on this batch**. Both candidate methods preserved all visible powers and registration statuses. One unreadable screenshot heading still needs a legion choice.
- Integrated screenshot manual-review reduction **failed** on the common set. Paste met the comparative review target on the common set with visually checked transcription. This run does not measure the transcription accuracy of an arbitrary external AI.
- Keep the production gate open for the integrated screenshot workflow. Name recognition quality is the remaining bottleneck. Evaluate any name recovery changes on a separate holdout, with reused or ambiguous names kept in review.

## Paste-first release candidate

Branch `fix/3573-paste-first` opens the shared roster importer on Paste player list and restores either type of saved draft. The approved compact review and gold Squad Balancer action are included. The automatic screenshot extractor in this branch uses the deployed production reader and its existing checkbox geometry. Commander layout recognition remains on `fix/3573-review-speed` pending its separate manual-review gate. Manual username rereading in review still uses the production geometry.

The public demo uses synthetic data. Private RKG pilot inputs run only in isolated browser storage with network writes blocked. Production promotion requires explicit approval after the real-device timing and organiser check.

The preview-only RKG pilot accepts a roster file at `event-preview.html?pilot=rkg`. Its event data stays in the current browser tab. The file is distributed separately and is excluded from both the source tree and the hosted demo assets. The automated isolated replay checks all 76 expected powers, the 28 combatants and seven substitutes in Legion 1, the 24 pre-existing Legion 2 assignments, and team generation and copying. Its timing is not a substitute for an organiser's iPhone run.
