-- 0003: Billing structure is EITHER per-apartment (automated engine) OR tier
-- (designer, manual issue). Adds the model switch + per-apartment discounting.
-- Applied to prod 2026-07-24 via Supabase MCP (migration: billing_model_and_pa_discount).

alter table public.building_billing
  add column if not exists billing_model text not null default 'per_apartment',
  add column if not exists pa_discount_pct numeric default 0,
  add column if not exists pa_discount_reason text,
  add column if not exists pa_discount_until date;

alter table public.building_billing drop constraint if exists building_billing_model_chk;
alter table public.building_billing
  add constraint building_billing_model_chk check (billing_model in ('per_apartment','tier'));

-- billing_daily v2: per-apartment automation gated on billing_model; discount
-- applied to trial messaging, pro-rata and the recurring invoice (explicit
-- negative line). Overdue/late-fee sweep still runs for every model.
-- (Full function body lives in prod; see the applied migration of the same name.)
