import { playerDetailsPath } from "./playerDetails.js";
import { rankingsPath } from "./rankings.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_ROOT = "https://api.whiteoutstats.com/v1";
const APP_ORIGINS = [
  "https://3543-intel.vercel.app",
  "https://3543-intel-git-feature-mightpulse-ede932-sunfire-castle-planner.vercel.app",
];
function allowedOrigins(): string[] {
  return [...new Set([...APP_ORIGINS, ...(Deno.env.get("MIGHTPULSE_ALLOWED_ORIGINS") || "")
    .split(",").map(x => x.trim()).filter(Boolean)])];
}
const ALLOWED_ACTIONS = new Set(["alliance", "rankings", "player_details"]);

function respond(body: unknown, status = 200, origin = ""): Response {
  const permitted = allowedOrigins();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin && permitted.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

Deno.serve(async req => {
  const origin = req.headers.get("origin") || "";
  const permittedOrigins = allowedOrigins();
  if (origin && !permittedOrigins.includes(origin)) return respond({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return respond({}, 204, origin);
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin);

  // A dedicated server token authorizes this shared site; the provider key stays in Supabase.
  const siteToken = req.headers.get("x-caroline-site-key") || "";
  const tokenDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(siteToken));
  const tokenHash = Array.from(new Uint8Array(tokenDigest)).map(v => v.toString(16).padStart(2,"0")).join("");
  if (siteToken.length < 32 || tokenHash !== "6a1e9094f4daa0772a0651b0ae239fa1db314a3c9b631c498c10394f63712ade") return respond({error:"Site access required"},401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const apiKey = Deno.env.get("WHITEOUTSTATS_API_KEY")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) return respond({ error: "Set WHITEOUTSTATS_API_KEY in Supabase Edge Function secrets using a Whiteout Stats wos_ key." }, 503, origin);
  if (!url || !anonKey || !serviceKey) {
    return respond({ error: "API integration is not fully configured" }, 503, origin);
  }

  if (!/^wos_[\x21-\x7E]+$/.test(apiKey)) {
    return respond({ error: "WHITEOUTSTATS_API_KEY contains an invalid value. Replace it in Supabase Edge Function secrets with the complete generated wos_ key." }, 503, origin);
  }

  let input: Record<string, unknown>;
  try { input = await req.json(); }
  catch { return respond({ error: "Invalid JSON" }, 400, origin); }

  const action = input.action;
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return respond({ error: "Unsupported action" }, 400, origin);
  }
  const state = Number(input.state);
  const fid = String(input.fid || "");
  const tag = String(input.tag || "");
  if (!Number.isSafeInteger(state) || state < 1 || state > 99999 || (action !== "rankings" && state !== 3573)) return respond({error:"Invalid state for requested action"},400);
  const validState = state === 3573;
  let path = "";
  if (action === "usage") path = "/usage";
  if (action === "player_details") path = playerDetailsPath(input.state, input.fid) || "";
  if (action === "rankings") path = rankingsPath(input.state, input.board, input.limit ?? 100) || "";
  if (action === "kingdom" && validState) path = `/states/${state}`;
  if (action === "alliance" && validState && /^[\p{L}\p{N}_-]{1,16}$/u.test(tag)) {
    path = `/alliances/${state}/${encodeURIComponent(tag)}?include=info,roster`;
  }
  if (action === "player" && /^\d{4,15}$/.test(fid)) {
    path = `/players/${fid}?include=base`;
  }
  if (!path) return respond({ error: "Invalid action parameters" }, 400, origin);

  // Fail closed unless database-backed limits are available. Do not trust Origin as authentication.
  // Each request consumes one per-client allowance and one global daily allowance.
  const limiter = createClient(url, serviceKey, { auth: { persistSession: false } });
  const claimedIp = "caroline3573-shared-site";
  const ipBytes = new TextEncoder().encode(claimedIp || "unknown");
  const digest = await crypto.subtle.digest("SHA-256", ipBytes);
  const clientHash = Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("");
  try {
    const { data: allowed, error: limitError } = await limiter.rpc("consume_whiteoutstats_lookup", { p_client_hash: clientHash });
    if (limitError) {
      console.error(JSON.stringify({ event: "lookup_limiter_unavailable", detail: limitError.code || "database_error" }));
      return respond({ error: "Lookup protection unavailable. Try later." }, 503, origin);
    }
    if (!allowed) return respond({ error: "Lookup limit reached. Try again later." }, 429, origin);
  } catch {
    return respond({ error: "Lookup protection unavailable. Try later." }, 503, origin);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 95000);
    let upstream: Response;
    try {
      upstream = await fetch(API_ROOT + path, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }
    const payload = await upstream.json().catch(() => ({ error: "Invalid upstream response" }));
    if (!upstream.ok) console.error(JSON.stringify({ event: "whiteoutstats_provider_error", action, status: upstream.status }));
    if (!upstream.ok) return respond({
      error: "Provider request failed", provider_status: upstream.status,
      provider_error: typeof payload?.error === "string" ? payload.error : undefined,
    }, [400, 401, 403, 404, 429].includes(upstream.status) ? upstream.status : 502, origin);
    if (action === "player_details") {
      const player = payload?.player;
      const chiefId = String(payload?.chief_id ?? player?.chief_id ?? player?.fid ?? "");
      if (!player || Number(player.kid) !== state || chiefId !== fid) {
        return respond({ error: "Provider returned a different player or state" }, 502, origin);
      }
    }
    return respond({
      source: "whiteoutstats", retrieved_at: new Date().toISOString(),
      data: payload,
    }, 200, origin);
  } catch (e) {
    const diagnostic = e instanceof Error ? `${e.name}: ${e.message}` : "Unknown transport error";
    console.error(JSON.stringify({ event: "whiteoutstats_transport_error", action, diagnostic: diagnostic.split(apiKey).join("[redacted]") }));
    return respond({ error: e instanceof Error && e.name === "AbortError"
      ? "Provider timed out" : "Provider unavailable" }, 502, origin);
  }
});
