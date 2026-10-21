# Arena portrait controls and research

Checked 2026-10-21. Scope: traditional Exploration Arena. Expedition Arena, troop marches and Bear Hunt have separate rules.

## Implementation brief

Make the existing hero portraits directly movable using mouse and phone touch. Swap within the same five-position team, preview the drop target, support tap/keyboard placement and Undo, and preserve hero equipment, Holger inputs and all roster records. Keep defence protected by default, with an explicit mode for correcting recorded position mapping. Investigate the requested community sources and apply only primary-source mechanics that can be verified. Clearly distinguish skill-text arithmetic, strategic trials and a validated combat simulation.

## Research findings

| Source | What was checked | Decision |
| --- | --- | --- |
| [WOS Nerds](https://wosnerds.com/) | Public tools index and data repository README | Good data/research starting point. A complete validated Exploration Arena engine was not established in the inspected material. |
| [WOS Nerds formation builder](https://wosnerds.com/formationbuilder/) | Troop counts, march sizes and allocation inputs | This tool allocates troop marches. Do not substitute it for a five-hero Arena engine. |
| [WOS Nerds troop stats](https://wosnerds.com/troop-stats/) | Infantry/Lancer/Marksman troop tables and draft warning | Troop stats do not establish Exploration hero damage, targeting or skill timing. |
| [Tonton Arena video](https://www.youtube.com/watch?v=Be-zQbjOEM8) | Original video URL located via a third-party summary | Direct video retrieval failed (disabled/throttled). Primary content and on-screen formation geometry could not be verified. No tier list, fixed targeting order or combat formula from that summary is treated as established. |
| [Official Combat FAQ](https://centurygames.helpshift.com/hc/en/64-whiteout-survival/faq/8048-combat-faq/) | Describes turn-based Expedition combat, troop casualties, rallies and garrisons | Do not apply that engine wholesale to Exploration Arena. |
| [Official Arena guide](https://www.whiteoutsurvival.wiki/guide-for-arena/) | Exploration skill scope, class counters and formation importance | Existing class rules retained. General frontline guidance remains a trial, not a universal optimum. |

A third-party lead was read to locate the original Tonton video: https://blog.astris.kr/en/posts/0e725673-24f7-481b-bbce-a1a03a4a10a1 . It explicitly describes uncertain positioning/transcript recovery. Its claim that Lynn does no damage conflicts with her official skill sheet. No assumption of a universal safest back slot was added.

## Verified hero skill references

The app now links these primary references and supplies concise paraphrases and level tables for selected Exploration effects:

- [Hector](https://www.whiteoutsurvival.wiki/heroes/hector/): control immunity during Sword Whirlwind; health-threshold effects change survival and Attack.
- [Mia](https://www.whiteoutsurvival.wiki/heroes/mia/): skill-text damage/healing base values have random ranges. No probability distribution or average is invented.
- [Lynn](https://www.whiteoutsurvival.wiki/heroes/lynn/): debuff removal, temporary immunity and enemy healing reduction matter. Lethal Finale also has an Attack-scaled damage coefficient.
- [Alonso](https://www.whiteoutsurvival.wiki/heroes/alonso/): area damage and immobilisation/stun effects matter independently of reported hero power.
- [Gwen](https://www.whiteoutsurvival.wiki/heroes/gwen-2/): Salvo explicitly targets rear enemies, heroes first. Sky Sniper specifies a chance of double damage. The misleading /heroes/gwen/ URL currently serves Norah; the identity-correct Gwen page is used.
- [Reina](https://www.whiteoutsurvival.wiki/heroes/reina/): dodge wording applies to Normal Attacks. It is not assumed to dodge all skill damage.

Conditional advisor notes now flag Lynn/Mia healing interactions, Gwen rear-targeting threats and Hector control-immunity windows. Hero presence is a prompt to check the actual unlocked skill; no specific fetched skill ID is silently mapped to these names.

## Formulas supported

The reference calculator evaluates only a selected named skill's published level coefficient against manually entered final Exploration Attack:

`skill-text base = final Attack × published coefficient / 100`

For a skill with a published random multiplier range, it also displays the resulting range. For percent buffs, reductions or dodge chance, it displays the percentage without treating that number as damage. Unknown levels or Attack values produce no numerical scaling output. Changing a skill clears its manually selected level. No maxed hero/base-wiki stat is substituted for a player's Attack, and neither equipment nor Holger bonuses are added again.

This is not final damage, healing received, DPS, time-to-kill or win probability. Defence mitigation, escort damage, targeting geometry, energy/cooldowns, animation timing, conditional windows, random distributions and modifier stacking still require validation. No Expedition Attack×Lethality model is imported into Exploration Arena.

## Interaction and verification

- Pointer Events and pointer capture support mouse and touch; native image dragging is suppressed.
- Highlighted source/destination, floating portrait, tap-to-swap and keyboard Enter/Space provide equivalent controls.
- Drops outside the same team, pointer cancellation, source changes and Escape do not move records. Cross-team swaps are rejected.
- Undo restores only the prior slots and clears confirmation; it keeps current hero objects and Holger settings.
- Defence portraits are protected initially. Adjust defence positions explicitly enables mapping changes, which can be undone and locked again. The fetched source snapshot and roster are never modified.
- At narrow widths the two boards stack so card buttons retain at least 44px touch targets.
- Existing saved-player, fetch and dropdown flows remain available.

Validation: all 123 Node tests pass. Browser fixture uses actual Chromium mouse and touch input, tests drop highlighting, mouse/touch swaps, Undo, keyboard/tap, Escape, cancelled and cross-board drops, defence unlock/relock, 320px target sizes, desktop layout and skill arithmetic without provider calls or roster writes. Physical iPhone Safari remains unverified.
