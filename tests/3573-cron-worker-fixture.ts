// Runs the actual Edge handler against a private synthetic database and provider.
const database = new URL(Deno.env.get("DATABASE_URL") ?? "");
if (database.hostname !== "127.0.0.1" || database.port !== "55444" || database.pathname !== "/postgres") {
  throw Error("The Cron fixture requires its isolated localhost database");
}
const provider = "https://api.whiteoutstats.com";
const fetchOriginal = globalThis.fetch;
const expected = new Set(["900000001", "900000002"]);
globalThis.fetch = (input, options) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin !== provider) return fetchOriginal(input, options);
  if (url.pathname === "/v1/usage") return Promise.resolve(Response.json({
    ok: true, daily: {limit: 5000, used: 0, remaining: 5000}, minute: {limit: 60, used: 0, remaining: 60}
  }));
  if (url.pathname !== "/v1/players") throw Error("An unexpected lookup ran");
  const ids = (url.searchParams.get("ids") ?? "").split(",");
  if (ids.length !== 2 || new Set(ids).size !== 2 || ids.some(id => !expected.has(id))) {
    throw Error("The worker exceeded the two-player fixture");
  }
  const at = new Date(Date.now() - 1000).toISOString();
  return Promise.resolve(Response.json({
    players: ids.map((fid) => ({player:{chief_id:fid,kid:3573,alliance:{abbr:"FARM"}},fresh:true,cached_at:at}))
  }));
};
await import("../supabase/functions/caroline3573-membership-worker/index.ts");
