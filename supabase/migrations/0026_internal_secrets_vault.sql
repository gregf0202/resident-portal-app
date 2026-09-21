-- 0026_internal_secrets_vault
-- billing-cron and inbound-email compared a shared secret, hard-coded in their source,
-- against a ?secret= query parameter, with verify_jwt=false. The value sat in source, in
-- the pg_cron command and in every request log. Both secrets are now generated here,
-- straight into Vault (the value never appears in code, in this file or in the repo),
-- read by the functions through a service-role-only RPC, and sent in a header, which
-- is the pattern send-email has used since 5 Aug 2026 (internal_email_token).

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'billing_cron_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'billing_cron_token',
      'Authenticates pg_cron to the billing-cron edge function (x-nalo-internal header). 0026.');
  end if;
  if not exists (select 1 from vault.secrets where name = 'inbound_email_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'inbound_email_token',
      'Authenticates an inbound email webhook to the inbound-email edge function. 0026.');
  end if;
end $$;

create or replace function public.internal_secret(p_name text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_name and p_name in ('billing_cron_token', 'inbound_email_token')
  limit 1;
$$;

revoke all on function public.internal_secret(text) from public, anon, authenticated;
grant execute on function public.internal_secret(text) to service_role;

-- The billing job now sends the secret as a header, read from Vault at run time, so the
-- job's command text holds no secret. cron.schedule with an existing name replaces it.
select cron.schedule(
  'nalohub-billing-daily',
  '0 20 * * *',
  $cmd$
  select net.http_get(
    url := 'https://lipwcsihcxndwwgzhiia.supabase.co/functions/v1/billing-cron',
    headers := jsonb_build_object('x-nalo-internal',
      (select decrypted_secret from vault.decrypted_secrets where name = 'billing_cron_token')),
    timeout_milliseconds := 55000
  )
  $cmd$
);
