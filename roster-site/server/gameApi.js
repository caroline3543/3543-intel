const productionProject = 'nrksysaynoklqzhyhnmd.supabase.co';

export function gameApiConfig(env = process.env) {
  const {GAME_API_URL: base, GAME_API_PUBLIC_KEY: key, GAME_SITE_TOKEN: token} = env;
  if (!base || !key || !token) return null;
  try {
    const url = new URL(base);
    if (env.VERCEL_ENV === 'preview' &&
        (url.hostname === productionProject || url.origin !== env.STATE_3573_PREVIEW_API_ORIGIN)) return null;
    return {base:url.origin, key, token};
  } catch {
    return null;
  }
}
