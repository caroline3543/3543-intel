# 3573 Caroline

Standalone Members site for State 3573. Uses the shared roster/profile components, with independent device storage and no access to the original app's cloud records.

## Hosting

Vercel project: `3573-caroline`; root directory: `roster-site`; include source files outside the root directory. Install with `npm ci --prefix ..`, build with `npm run build`, publish `dist`.

Server-only environment variables:

- `ACCESS_PASSWORD_HASH`: `salt:scrypt(password, salt, 32)` as hexadecimal.
- `SESSION_SECRET`: at least 32 random bytes; changing it signs everyone out.
- `GAME_API_URL`: existing Supabase project URL.
- `GAME_API_PUBLIC_KEY`: existing public client key, used only by the server here.
- `GAME_SITE_TOKEN`: random server token matching the SHA-256 digest in the dedicated `caroline3573` Edge Function.

No password, session signing key, server token, or private provider key belongs in Vite variables or source files. The provider key remains in Supabase project secrets. The Edge Function checks the server token, restricts requests to State 3573, and uses the existing database-backed lookup limiter. Existing `whiteoutstats` officer access is unchanged.

Sessions last eight hours and use Secure, HttpOnly, SameSite=Strict cookies. API calls require the session and a matching request Origin. Password changes invalidate existing sessions because the password hash participates in session signatures.

The login attempt counter is per function instance; the generated high-entropy password is the primary brute-force protection. All game lookups additionally use durable server-side limits. Each visitor keeps their roster edits on their own device and can download a JSON backup.

First-run setup offers ARC, RKG and LUN individually or together; no game API requests happen automatically on page open. The three-step tour can be replayed from Help. Preferences are stored per device under `caroline3573_preferences_v1`. Button vibration uses the supported Vibration API with a visual pressed state on all devices; unsupported vibration calls do not block actions.
