# State 3573 Soft Dark profile

The isolated Vercel preview includes `/profile-preview.html`. It renders the same profile component with a fictional player whose fields match the three design references. Edits there live in memory. It does not load the workspace or make provider calls. Production builds exclude this entry. The workspace API separately rejects preview requests aimed at the production Supabase project.

Browser captures use 428 CSS px for the reference iPhone layout and check 320 and 1280 px for overflow. The test validates visible event power, the eleven cards, the four collapsed details rows, editing, clipboard actions and the read-only fixture. The workspace API tests cover signed sessions and same-origin writes.

Profile editing uses the existing shared roster password and signed session. Anyone who can sign in with that password can edit the profile. The redesign requires no organiser IDs or new access settings.

The location card reads saved coordinates or coordinates from a matching individual provider profile. It labels the age using the provider cache timestamp when available. Profiles without a usable pair show “Not recorded”. The TAL card also reads saved plan records. Older TAL records without a timestamp are shown with “Date not recorded”. Legacy tier timestamps combine furnace and troop edits, so the profile uses the dedicated troop tier timestamp for new tier edits.
