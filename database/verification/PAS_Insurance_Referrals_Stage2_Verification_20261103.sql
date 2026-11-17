-- PAS — Stage 2 insurer-prescription/referral verification
-- Read-only metadata checks. Run after the Stage-2 manual patch commits.
-- This script does not read patient clinical values or mutate rows/schema.

-- 1) Required RPCs and helper routines must exist with exact signatures.
with expected(signature) as (
  values
    ('public.pas_get_patient_insurance_prescriptions(integer,integer)'),
    ('public.pas_get_doctor_patient_insurance_prescriptions(uuid,integer,integer)'),
    ('public.pas_get_doctor_insurance_result_detail(uuid)'),
    ('public.pas_patient_issue_referral_qr_token(uuid,text,timestamp with time zone)'),
    ('public.pas_patient_revoke_referral_qr_token(uuid)'),
    ('public.pas_issue_referral_qr_token(uuid,text,timestamp with time zone)'),
    ('public.pas_resolve_referral_qr_token(text)'),
    ('private.pas_can_read_insurance_service(uuid,text)'),
    ('private.pas_guard_execution_referral_not_expired()'),
    ('private.pas_guard_execution_referral_item_not_expired()'),
    ('private.pas_guard_referral_qr_parent_expiry()'),
    ('private.pas_guard_provider_membership_profile()'),
    ('private.pas_guard_profile_role_provider_membership()'),
    ('private.pas_respond_to_referral(uuid,text,text)'),
    ('private.pas_update_referral_item(uuid,text,numeric,text)'),
    ('private.pas_reconcile_referral_from_items()'),
    ('private.pas_reconcile_referral_from_results()')
)
select signature, to_regprocedure(signature) is not null as exists
from expected
order by signature;

-- 2) A failed preflight means the patch was not applied or the schema has drifted.
do $verify$
declare
  v_missing text[];
begin
  select array_agg(signature order by signature)
  into v_missing
  from (values
    ('public.pas_get_patient_insurance_prescriptions(integer,integer)'),
    ('public.pas_get_doctor_patient_insurance_prescriptions(uuid,integer,integer)'),
    ('public.pas_get_doctor_insurance_result_detail(uuid)'),
    ('public.pas_patient_issue_referral_qr_token(uuid,text,timestamp with time zone)'),
    ('public.pas_patient_revoke_referral_qr_token(uuid)'),
    ('public.pas_issue_referral_qr_token(uuid,text,timestamp with time zone)'),
    ('public.pas_resolve_referral_qr_token(text)'),
    ('private.pas_respond_to_referral(uuid,text,text)'),
    ('private.pas_update_referral_item(uuid,text,numeric,text)'),
    ('private.pas_reconcile_referral_from_items()'),
    ('private.pas_reconcile_referral_from_results()')
  ) as required(signature)
  where to_regprocedure(signature) is null;

  if v_missing is not null then
    raise exception 'Stage-2 RPC verification failed; missing: %', array_to_string(v_missing, ', ');
  end if;

  if exists (
    select 1
    from public.pas_provider_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.status = 'active' and p.role = 'patient'
  ) then
    raise exception 'Stage-2 membership invariant failed: an active patient provider membership exists';
  end if;
end;
$verify$;

-- 3) Public RPC execution policy: no anon/PUBLIC access; authenticated only.
select p.oid::regprocedure as function_signature,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       coalesce(array_to_string(p.proconfig, ';'), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'pas_get_patient_insurance_prescriptions',
    'pas_get_doctor_patient_insurance_prescriptions',
    'pas_get_doctor_insurance_result_detail',
    'pas_patient_issue_referral_qr_token',
    'pas_patient_revoke_referral_qr_token'
  )
order by p.proname, p.oid::regprocedure::text;

-- 4) Sensitive insurer/referral/result/QR tables must remain RLS-enabled and
--    inaccessible through direct anon/authenticated table grants.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'pas_insurance_prescriptions',
    'pas_insurance_prescription_items',
    'pas_insurance_identity_reviews',
    'pas_insurance_identity_candidates',
    'pas_execution_referrals',
    'pas_execution_referral_items',
    'pas_referral_results',
    'pas_referral_events',
    'pas_referral_qr_tokens',
    'pas_referral_lab_values',
    'pas_referral_imaging_reports',
    'pas_referral_pharmacy_dispenses',
    'pas_referral_service_results'
  )
order by c.relname;

-- 5) New expiry and membership guards must be attached to the intended tables.
select c.relname as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and t.tgname in (
    'trg_pas_guard_execution_referral_not_expired',
    'trg_pas_guard_execution_referral_item_not_expired',
    'trg_pas_guard_referral_qr_insert_expiry',
    'trg_pas_guard_referral_qr_resolve_expiry',
    'trg_pas_guard_provider_membership_profile',
    'trg_pas_guard_profile_role_provider_membership'
  )
order by c.relname, t.tgname;

-- 6) Confirm all expected triggers exist. This raises if a trigger is missing.
do $triggers$
declare
  v_missing text[];
begin
  select array_agg(expected.name order by expected.name)
  into v_missing
  from (values
    ('trg_pas_guard_execution_referral_not_expired'),
    ('trg_pas_guard_execution_referral_item_not_expired'),
    ('trg_pas_guard_referral_qr_insert_expiry'),
    ('trg_pas_guard_referral_qr_resolve_expiry'),
    ('trg_pas_guard_provider_membership_profile'),
    ('trg_pas_guard_profile_role_provider_membership')
  ) as expected(name)
  where not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and t.tgname = expected.name
  );

  if v_missing is not null then
    raise exception 'Stage-2 trigger verification failed; missing: %', array_to_string(v_missing, ', ');
  end if;
end;
$triggers$;

-- 7) Existing provider QR entry points must remain available to authenticated
--    users and must not be callable anonymously.
select p.oid::regprocedure as function_signature,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'pas_issue_referral_qr_token',
    'pas_resolve_referral_qr_token',
    'pas_respond_to_referral',
    'pas_update_referral_item'
  )
order by p.proname;

-- 8) Lock-order routines are not directly callable by anon; authenticated
--    access is retained for the two existing provider mutation routines.
select p.oid::regprocedure as function_signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in (
    'pas_respond_to_referral',
    'pas_update_referral_item',
    'pas_reconcile_referral_from_items',
    'pas_reconcile_referral_from_results'
  )
order by p.proname;

-- Application-level acceptance checks must still be run using real test accounts:
-- patient A / patient B; doctor with labs only; doctor with diagnostics only;
-- doctor with medications only; center A / center B; pharmacy A / pharmacy B.
-- See PAS_Insurance_Referrals_Stage2_Report.fa.md for the exact matrix.
