# Northwind People — deployment & environment

## 1. Environment variables

Only the two public Supabase values ever reach the browser bundle. Everything else is
server-side and must never be prefixed with `VITE_`.

### Client (build-time, safe to expose)

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://abcd1234.supabase.co` | Project REST/Auth endpoint. |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Anonymous key. Safe **only** because RLS is enabled and forced on every table. |
| `VITE_APP_URL` | `https://people.northwind.com` | Base URL used to build invitation links. |

### Server / edge functions (secret — never expose)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. Used only by the invitation email edge function and scheduled jobs. |
| `SUPABASE_DB_URL` | Direct Postgres connection for migrations and pgTAP tests. |
| `INVITE_TOKEN_PEPPER` | Extra secret mixed into the invitation token before hashing. |
| `RESEND_API_KEY` (or SMTP equivalent) | Sends invitation and leave-decision emails. |
| `SENTRY_DSN` | Error reporting. Optional. |

Rules:

- Never put the service-role key in a `VITE_` variable, in client code, or in the repo.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` and `INVITE_TOKEN_PEPPER` on staff offboarding.
- Set `Site URL` and `Redirect URLs` in Supabase Auth to `VITE_APP_URL` only.
- Enable email confirmations and leaked-password protection in Supabase Auth.

## 2. Database migrations

Migrations are ordered and idempotent per file. Apply with `supabase db push` (or
`supabase migration up`) in this order:

| File | Contents |
| --- | --- |
| `20260101000000_init_schema.sql` | Extensions, enums, tables, constraints, indexes. |
| `20260101000100_functions.sql` | `is_admin()`, `is_active()`, `business_days()`, derived `leave_balances` view, column-protection and entitlement triggers, `accept_invitation()` RPC. |
| `20260101000200_rls_policies.sql` | RLS enabled + forced on every table, one policy per access rule, grants revoked from `anon`. |
| `20260101000300_notification_triggers.sql` | Database-side notification fan-out and audit-log writes. |

Verify after every deploy:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and rowsecurity = false; -- must return zero rows
```

## 3. Security model in one page

- **Deny by default.** RLS is `enable`d and `force`d on every table; `anon` has no table grants.
- **Role never comes from the client.** `public.is_admin()` is a `SECURITY DEFINER`
  function that reads the caller's `profiles` row, so a forged JWT claim or a tampered
  client session changes nothing.
- **Field-level authorization.** Employees may update only `phone`, `location`,
  `timezone` and `emergency_contact`. `protect_privileged_profile_columns()` reverts
  anything else, even on a direct PostgREST call.
- **Separation of duties.** An administrator cannot approve their own leave — enforced by
  both the `leave_no_self_approval` constraint and the `leave_decide_admin` policy.
- **Derived balances.** `public.leave_balances` is a view over the requests table, so an
  approval and its balance can never drift apart.
- **Append-only audit.** `public.audit_logs` has `SELECT` (admin) and `INSERT`
  (`actor_id = auth.uid()`) policies and deliberately no `UPDATE`/`DELETE` policy.
- **Single-use invitations.** Only the SHA-256 hash of the token is stored; the raw token
  lives in the emailed link. Acceptance runs through one `SECURITY DEFINER` RPC that takes
  the role from the invitation row.

## 4. Testing the security model

- `supabase test db` runs `supabase/tests/rls_policies.test.sql` (pgTAP) against the real
  policies in CI.
- The **Security checks** screen (HR administrators only) runs the same scenarios against
  the running application and reports pass/fail. Every scenario expects a rejection, so it
  never mutates data.

Both must be green before a release is considered production-ready.

## 5. Wiring the real backend

This build ships with an in-browser data layer so the product can be reviewed end to end
without a database. It is structured so the swap is mechanical:

| Replace | With |
| --- | --- |
| `utils/api/auth.ts` | `supabase.auth.signInWithPassword` / `signOut` / `getSession`. |
| `utils/api/*.ts` query bodies | `supabase.from('<table>').select(...)` — the policy guards become redundant but are kept as defence in depth. |
| `utils/store.ts` | Deleted; the Supabase client replaces it. |

`utils/policies.ts` intentionally mirrors the SQL policies one-to-one, so any change to a
policy must be made in both places and covered by both test suites.

## 6. Build & deploy checklist

1. `npm run build` — TypeScript must compile with no errors.
2. `supabase db push` against staging, then `supabase test db`.
3. Run the in-app **Security checks** screen on staging; all scenarios must pass.
4. Confirm no `service_role` key is present in the built bundle: `grep -r "service_role" dist/`.
5. Promote to production and re-run steps 2–4.
