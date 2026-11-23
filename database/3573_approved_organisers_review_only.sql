-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Approved-organiser permissions for State 3573.
-- This draft establishes a private allowlist, not a public role editor.
-- A later migration must integrate this allowlist with a tightly scoped,
-- server-authorised guarded RPC and verify existing writer compatibility.
--
-- IMPORTANT: Adding a permissive UPDATE policy for approved organisers on
-- public.players would also allow direct PostgREST UPDATE of arbitrary JSON.
-- DO NOT add such a policy. The existing owner-only policy remains unchanged.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists app_private.state3573_profile_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  revoked_at timestamptz,
  constraint approval_not_self check (approved_by is null or approved_by <> user_id)
);

revoke all on app_private.state3573_profile_editors from public, anon, authenticated;

-- Provisioning is an administrator-only operation via a trusted SQL session.
-- Do not expose insert/update/delete of this table through client APIs.
-- No organiser is seeded here, intentionally: approval requires an explicit
-- user UUID and administrative confirmation.
--
-- An authenticated user's app_metadata or auth.uid() may identify the user,
-- but client-editable user_metadata must never be an authorisation source.
--
-- Implementation dependency:
-- The guarded save RPC must check the caller's auth.uid() against this table
-- using a carefully audited privileged function, then atomically update only
-- permitted JSON keys and the 3573 row. An equivalent guarded snapshot-read
-- RPC is required because the current players SELECT RLS allows only the owner.
--
-- STOP: this draft alone does not grant editing or change any existing RLS.
