import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars aren't set (e.g. local dev before .env is configured), cloud
// sync silently no-ops instead of crashing the app — everything keeps
// working off localStorage alone.
export const supabase = (url && key) ? createClient(url, key) : null;
