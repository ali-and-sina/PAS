-- Read-only verification for PAS multi-service center routing.
-- Run after migration 20261103224500_pas_multi_service_center_routing_v1.

-- 1) Migration history (if this project uses the standard Supabase migration table).
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20261103224500';

-- 2) Service capability column, default and supporting index.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pas_provider_services'
  AND column_name = 'is_active';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'pas_provider_services'
  AND indexname = 'pas_provider_services_active_lookup_idx';

-- 3) Core functions and callable privileges.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') AS function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'private' AND p.proname IN (
  'pas_center_accepts',
  'pas_center_has_service',
  'pas_admin_set_center_services',
  'pas_guard_medical_request_provider_assignment',
  'pas_my_center_service_policies',
  'pas_search_service_providers',
  'pas_service_providers',
  'pas_center_worklist'
)) OR (n.nspname = 'public' AND p.proname = 'pas_admin_set_center_services')
ORDER BY n.nspname, p.proname;

-- 4) Mandatory provider-assignment trigger and its lock-sensitive function contracts.
SELECT t.tgname, pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.pas_medical_requests'::regclass
  AND NOT t.tgisinternal
  AND t.tgname = 'pas_medical_request_provider_guard';

SELECT
  (SELECT pg_get_functiondef('private.pas_guard_medical_request_provider_assignment()'::regprocedure)) AS assignment_guard_definition,
  (SELECT pg_get_functiondef('private.pas_center_set_patient_request_policy(text,boolean)'::regprocedure)) AS policy_setter_definition;

-- 5) RLS is still enabled; provider access policies now use the correct active/history helpers.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'pas_provider_services',
    'pas_medical_requests',
    'pas_medical_results',
    'pas_therapy_sessions'
  )
ORDER BY c.relname;

SELECT c.relname AS table_name, p.polname AS policy_name,
       pg_get_expr(p.polqual, p.polrelid) AS using_expression
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND p.polname IN (
    'pas_provider_read',
    'pas_medical_center_boundary',
    'pas_medical_result_center_boundary',
    'pas_therapy_read'
  )
ORDER BY c.relname, p.polname;

-- 6) Direct writes remain unavailable to authenticated users.
SELECT
  has_table_privilege('authenticated', 'public.pas_provider_services', 'INSERT') AS authenticated_can_insert_capabilities,
  has_table_privilege('authenticated', 'public.pas_provider_services', 'UPDATE') AS authenticated_can_update_capabilities,
  has_table_privilege('authenticated', 'public.pas_provider_services', 'DELETE') AS authenticated_can_delete_capabilities,
  has_table_privilege('authenticated', 'public.pas_medical_requests', 'INSERT') AS authenticated_can_insert_requests,
  has_table_privilege('authenticated', 'public.pas_medical_requests', 'UPDATE') AS authenticated_can_update_requests,
  has_table_privilege('authenticated', 'public.pas_medical_requests', 'DELETE') AS authenticated_can_delete_requests;

-- 7) Approved capabilities by center. Inactive rows are retained as history.
SELECT
  c.display_name,
  c.center_type,
  s.service_kind,
  s.is_active
FROM public.pas_medical_centers c
JOIN public.pas_provider_services s ON s.provider_id = c.profile_id
ORDER BY c.display_name, s.service_kind;

-- 8) An inactive capability must not keep direct-patient intake enabled.
SELECT count(*)::integer AS inactive_services_with_direct_intake_enabled
FROM public.pas_provider_services s
JOIN public.pas_center_service_policies pol
  ON pol.provider_id = s.provider_id
 AND pol.service_kind = s.service_kind
WHERE NOT s.is_active
  AND pol.patient_requests_enabled;

-- 9) Existing doctor-origin requests that already had a center remain grandfathered; do not
-- silently unassign accepted/in-progress work. New doctor-origin requests are rejected with provider_id.
SELECT request_source, status, (provider_id IS NOT NULL) AS has_provider, count(*)::integer AS request_count
FROM public.pas_medical_requests
GROUP BY request_source, status, (provider_id IS NOT NULL)
ORDER BY request_source, status, has_provider;

-- 10) A newly applied migration must leave zero unaccepted doctor-origin requests with a provider.
SELECT count(*)::integer AS unaccepted_doctor_requests_with_provider
FROM public.pas_medical_requests
WHERE request_source = 'doctor' AND provider_id IS NOT NULL AND status = 'requested';

-- 11) Deactivation precondition: this count should be zero before an administrator can disable.
SELECT provider_id, service_kind, count(*)::integer AS open_request_count
FROM public.pas_medical_requests
WHERE status IN ('requested','accepted','in_progress')
GROUP BY provider_id, service_kind
ORDER BY provider_id, service_kind;

-- 12) Historical-presence check: archived capability rows remain recognized by the history helper.
SELECT
  s.provider_id,
  s.service_kind,
  s.is_active,
  private.pas_center_accepts(s.provider_id, s.service_kind) AS accepts_new_routing,
  private.pas_center_has_service(s.provider_id, s.service_kind) AS retains_historical_access
FROM public.pas_provider_services s
ORDER BY s.provider_id, s.service_kind;
