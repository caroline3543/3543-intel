import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_ROOT = "https://api.mightpulse.com/v1";
const APP_ORIGINS = [
  "https://3543-intel.vercel.app",
  "https://3543-intel-git-feature-mightpulse-ede932-sunfire-castle-planner.vercel.app",
];
function allowedOrigins(): string[] {
  return [...new Set([...APP_ORIGINS, ...(Deno.env.get("MIGHTPULSE_ALLOWED_ORIGINS") || "")
    .split(",").map(x => x.trim()).filter(Boolean)])];
}
const ALLOWED_ACTIONS = new Set(["usage", "alliance", "kingdom", "player"]);

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

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const apiKey = Deno.env.get("MIGHTPULSE_API_KEY")?.trim();
  const officerIds = (Deno.env.get("MIGHTPULSE_ALLOWED_USER_IDS") || "")
    .split(",").map(x => x.trim()).filter(Boolean);
  if (!url || !anonKey || !apiKey || officerIds.length === 0) {
    return respond({ error: "API integration is not fully configured" }, 503, origin);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return respond({ error: "Sign-in required" }, 401, origin);
  const supabase = createClient(url, anonKey);
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return respond({ error: "Invalid user session" }, 401, origin);
  if (!officerIds.includes(user.id)) return respond({ error: "Officer access required" }, 403, origin);

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
  const validState = Number.isSafeInteger(state) && state >= 1 && state <= 99999;
  let path = "";
  if (action === "usage") path = "/usage";
  if (action === "kingdom" && validState) path = `/kingdoms/${state}`;
  if (action === "alliance" && validState && /^[\p{L}\p{N}_-]{1,16}$/u.test(tag)) {
    path = `/alliances/${state}/${encodeURIComponent(tag)}?include=info,roster`;
  }
  if (action === "player" && /^\d{4,15}$/.test(fid)) {
    path = `/players/${fid}?include=base`;
  }
  if (!path) return respond({ error: "Invalid action parameters" }, 400, origin);

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
    if (!upstream.ok) console.error(JSON.stringify({ event: "mightpulse_provider_error", action, status: upstream.status }));
    if (!upstream.ok) return respond({
      error: "Provider request failed", provider_status: upstream.status,
      provider_error: typeof payload?.error === "string" ? payload.error : undefined,
    }, [400, 401, 403, 404, 429].includes(upstream.status) ? upstream.status : 502, origin);
    return respond({
      source: "mightpulse", retrieved_at: new Date().toISOString(),
      data: payload,
    }, 200, origin);
  } catch (e) {
    const diagnostic = e instanceof Error ? `${e.name}: ${e.message}` : "Unknown transport error";
    console.error(JSON.stringify({ event: "mightpulse_transport_error", action, diagnostic: diagnostic.split(apiKey).join("[redacted]") }));
    return respond({ error: e instanceof Error && e.name === "AbortError"
      ? "Provider timed out" : "Provider unavailable" }, 502, origin);
  }
});
