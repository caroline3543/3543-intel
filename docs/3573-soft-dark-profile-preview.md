# State 3573 Soft Dark profile

The isolated Vercel preview includes `/profile-preview.html`. It renders the same profile component with a fictional player whose fields match the three design references. Edits there live in memory. It does not load the workspace or make provider calls. Production builds exclude this entry. The workspace API separately rejects preview requests aimed at the production Supabase project.

Browser captures use 428 CSS px for the reference iPhone layout and check 320 and 1280 px for overflow. The test validates visible event power, the eleven cards, the four collapsed details rows, editing, clipboard actions and the read-only fixture. The workspace API tests verify approved and revoked organiser credentials independently.

Before production approval, reserve the owner credential for Caroline. If the previous leader password was shared, rotate it as part of the approved release. Set the server-side `ACCESS_ORGANISER_HASHES` JSON object to approved organiser IDs and independently generated password hashes, or `{}` for owner-only access. With that setting present, old shared-session tokens are rejected. An organiser signs in using their ID and password. Removing an ID or replacing its hash invalidates that organiser's sessions. Keep the owner and organiser credentials private and out of the repository.

The location card reads a saved coordinate observation with its own timestamp. A membership lookup only confirms a state and alliance. Profiles without a stored coordinate observation show “Not recorded”. Legacy tier timestamps combine furnace and troop edits, so the profile uses the dedicated troop tier timestamp for new tier edits.
