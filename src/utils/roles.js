import { C } from './constants.js';
import { uid } from './dates.js';

// ── roles ──────────────────────────────────────────────────────
// "Rally Lead" is the only role with unique game behaviour (it drives
// march-time auto-fill, the leader picker in Battle Plans, etc.), so it's
// the one permanent, built-in role. Every other role is alliance-defined —
// created, renamed, deleted, and reordered by the user. Nothing else is
// hardcoded.

export const BUILTIN_ROLE = 'Rally Lead';

const BUILTIN_ROLE_DEF = { id: 'builtin-rally-lead', name: BUILTIN_ROLE, color: C.gold, icon: '👑', builtin: true };

// Assigned automatically, in rotation, when a new custom role is created.
// Per-role colour/icon pickers would slot in here later if needed — the
// data shape (color/icon per role) already supports it; there's just no
// picker UI yet.
const ROLE_COLOR_PALETTE = [C.red, C.mar, C.inf, C.lan, C.icy, C.muted];
const DEFAULT_ROLE_ICON  = '🏷️';

// Returns the full role list (builtin first) used everywhere in the UI.
export function withBuiltinRole(customRoles = []) {
  return [BUILTIN_ROLE_DEF, ...customRoles];
}

export function newRoleDef(name, existingCustomCount = 0) {
  return {
    id:      uid(),
    name:    name.trim(),
    color:   ROLE_COLOR_PALETTE[existingCustomCount % ROLE_COLOR_PALETTE.length],
    icon:    DEFAULT_ROLE_ICON,
    builtin: false,
  };
}

export function roleColor(roleName, roles) {
  return roles.find(r => r.name === roleName)?.color || C.muted;
}

export function roleIcon(roleName, roles) {
  return roles.find(r => r.name === roleName)?.icon || DEFAULT_ROLE_ICON;
}
