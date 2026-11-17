-- PAS medical-center routing: patient-owned provider selection and multi-service capabilities.
-- Additive migration. Existing provider service rows remain archived when disabled.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.pas_medical_centers') IS NULL
     OR to_regclass('public.pas_provider_services') IS NULL
     OR to_regclass('public.pas_medical_requests') IS NULL
     OR to_regclass('public.pas_center_service_policies') IS NULL THEN
    RAISE EXCEPTION 'PAS center routing Phase 1 schema is missing; restore/apply the canonical prerequisite migrations first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pas_medical_requests' AND column_name='request_source'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pas_medical_requests' AND column_name='requested_by'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pas_medical_requests' AND column_name='patient_preferred_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pas_medical_requests' AND column_name='idempotency_key'
  ) THEN
    RAISE EXCEPTION 'PAS medical request Phase 1 columns are missing; this migration requires the canonical patient-imaging Phase 1 migration.';
  END IF;

  IF to_regprocedure('private.pas_role()') IS NULL
     OR to_regprocedure('private.pas_center_is_admin()') IS NULL
     OR to_regprocedure('private.pas_center_set_patient_request_policy(text,boolean)') IS NULL
     OR to_regprocedure('private.pas_create_patient_medical_request(jsonb)') IS NULL
     OR to_regprocedure('private.pas_center_worklist(uuid,integer,text,text,timestamp with time zone,timestamp with time zone)') IS NULL
     OR to_regprocedure('private.pas_guard_provider_services()') IS NULL
     OR to_regprocedure('private.pas_care_command(text,jsonb)') IS NULL
     OR to_regprocedure('private.pas_care_command_v1(text,jsonb)') IS NULL
     OR to_regprocedure('public.pas_care_command(text,jsonb)') IS NULL
     OR to_regprocedure('public.pas_center_set_patient_request_policy(text,boolean)') IS NULL
     OR to_regprocedure('public.pas_my_center_service_policies()') IS NULL
     OR to_regprocedure('public.pas_search_service_providers(text,text,integer,integer)') IS NULL
     OR to_regprocedure('public.pas_service_providers()') IS NULL THEN
    RAISE EXCEPTION 'Required PAS center and patient-imaging routines are missing; migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (c.relname, p.polname) IN (
        ('pas_provider_services','pas_provider_read'),
        ('pas_medical_requests','pas_medical_center_boundary'),
        ('pas_medical_results','pas_medical_result_center_boundary'),
        ('pas_therapy_sessions','pas_therapy_read')
      )
    GROUP BY n.nspname
    HAVING count(*) = 4
  ) THEN
    RAISE EXCEPTION 'Required center/provider RLS policies are missing; migration stopped.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.pas_medical_requests r
     WHERE r.request_source = 'doctor'
       AND r.provider_id IS NOT NULL
       AND r.status = 'requested'
  ) THEN
    RAISE EXCEPTION 'Unaccepted doctor-origin requests already have a center. Review/reassign those requests before enabling patient-owned routing.';
  END IF;
END;
$preflight$;

-- Existing capabilities default to active. Disabling a capability never deletes its row.
ALTER TABLE public.pas_provider_services
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS pas_provider_services_active_lookup_idx
  ON public.pas_provider_services(provider_id, service_kind)
  WHERE is_active;

COMMENT ON COLUMN public.pas_provider_services.is_active IS
  'Administrator-controlled capability flag. False archives the declaration without deleting history.';

-- Current capability: used when offering a new destination or accepting a new request.
CREATE OR REPLACE FUNCTION private.pas_center_accepts(p_id uuid, p_service text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.pas_medical_centers c
      JOIN public.profiles p ON p.id = c.profile_id
      JOIN public.pas_provider_services s ON s.provider_id = c.profile_id
     WHERE c.profile_id = p_id
       AND c.is_active
       AND p.role = 'laboratory'
       AND s.service_kind = p_service
       AND s.is_active
  );
$function$;

-- Historical capability: permits the owning center to retain access to existing work/results
-- after an administrator disables new intake for that service. It does not permit new routing.
CREATE OR REPLACE FUNCTION private.pas_center_has_service(p_id uuid, p_service text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.pas_medical_centers c
      JOIN public.profiles p ON p.id = c.profile_id
      JOIN public.pas_provider_services s ON s.provider_id = c.profile_id
     WHERE c.profile_id = p_id
       AND c.is_active
       AND p.role = 'laboratory'
       AND s.service_kind = p_service
  );
$function$;

REVOKE ALL ON FUNCTION private.pas_center_accepts(uuid,text), private.pas_center_has_service(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pas_center_accepts(uuid,text), private.pas_center_has_service(uuid,text)
  TO authenticated, service_role;

-- Only platform administrators may change declared center capabilities.
-- Open requests prevent deactivation; rows are archived instead of deleted.
CREATE OR REPLACE FUNCTION private.pas_admin_set_center_services(
  p_provider_id uuid,
  p_service_kinds text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_center public.pas_medical_centers%ROWTYPE;
  v_removed text[] := ARRAY[]::text[];
  v_previous text[] := ARRAY[]::text[];
  v_requested text[] := ARRAY[]::text[];
BEGIN
  IF v_actor IS NULL OR NOT private.pas_center_is_admin()
     OR NOT EXISTS (SELECT 1 FROM public.admin_profiles a WHERE a.id = v_actor) THEN
    RAISE EXCEPTION 'Administrator permission required' USING errcode = '42501';
  END IF;

  IF p_provider_id IS NULL OR p_service_kinds IS NULL
     OR cardinality(p_service_kinds) > 8
     OR array_position(p_service_kinds, NULL::text) IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM unnest(p_service_kinds) AS requested(service_kind)
        WHERE requested.service_kind NOT IN ('ct','mri','ecg','ultrasound','mammography','xray','physiotherapy','other')
     )
     OR cardinality(p_service_kinds) <> (
       SELECT count(DISTINCT requested.service_kind)::integer
         FROM unnest(p_service_kinds) AS requested(service_kind)
     ) THEN
    RAISE EXCEPTION 'Invalid or duplicate center service capabilities' USING errcode = '22023';
  END IF;

  SELECT * INTO v_center
    FROM public.pas_medical_centers
   WHERE profile_id = p_provider_id
   FOR UPDATE;

  IF NOT FOUND OR v_center.center_type = 'laboratory'
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = p_provider_id AND p.role = 'laboratory'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.laboratory_profiles lp WHERE lp.id = p_provider_id
     ) THEN
    RAISE EXCEPTION 'Medical center account not found or not configurable' USING errcode = '23503';
  END IF;

  SELECT coalesce(array_agg(s.service_kind ORDER BY s.service_kind), ARRAY[]::text[])
    INTO v_previous
    FROM public.pas_provider_services s
   WHERE s.provider_id = p_provider_id AND s.is_active;

  SELECT coalesce(array_agg(s.service_kind ORDER BY s.service_kind), ARRAY[]::text[])
    INTO v_removed
    FROM public.pas_provider_services s
   WHERE s.provider_id = p_provider_id
     AND s.is_active
     AND NOT (s.service_kind = ANY (p_service_kinds));

  IF cardinality(v_removed) > 0 AND EXISTS (
    SELECT 1
      FROM public.pas_medical_requests r
     WHERE r.provider_id = p_provider_id
       AND r.service_kind = ANY (v_removed)
       AND r.status IN ('requested','accepted','in_progress')
  ) THEN
    RAISE EXCEPTION 'A service cannot be disabled while it has open or in-progress requests. Resolve those requests first.'
      USING errcode = '23514';
  END IF;

  UPDATE public.pas_provider_services
     SET is_active = (service_kind = ANY (p_service_kinds))
   WHERE provider_id = p_provider_id;

  INSERT INTO public.pas_provider_services(provider_id, service_kind, is_active)
  SELECT p_provider_id, requested.service_kind, true
    FROM unnest(p_service_kinds) AS requested(service_kind)
  ON CONFLICT (provider_id, service_kind)
  DO UPDATE SET is_active = true;

  -- A disabled service must not silently re-enable direct-patient intake when restored later.
  IF cardinality(v_removed) > 0 THEN
    UPDATE public.pas_center_service_policies
       SET patient_requests_enabled = false,
           updated_by = v_actor,
           updated_at = now()
     WHERE provider_id = p_provider_id
       AND service_kind = ANY (v_removed)
       AND patient_requests_enabled;
  END IF;

  SELECT coalesce(array_agg(s.service_kind ORDER BY s.service_kind), ARRAY[]::text[])
    INTO v_requested
    FROM public.pas_provider_services s
   WHERE s.provider_id = p_provider_id AND s.is_active;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor,
    'center.services.updated',
    'pas_medical_centers',
    p_provider_id,
    jsonb_build_object(
      'center_type', v_center.center_type,
      'previous_active_services', to_jsonb(v_previous),
      'active_services', to_jsonb(v_requested),
      'disabled_services', to_jsonb(v_removed)
    )
  );

  RETURN jsonb_build_object(
    'provider_id', p_provider_id,
    'active_services', to_jsonb(v_requested),
    'disabled_services', to_jsonb(v_removed)
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.pas_admin_set_center_services(uuid,text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pas_admin_set_center_services(uuid,text[])
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pas_admin_set_center_services(
  p_provider_id uuid,
  p_service_kinds text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.pas_admin_set_center_services(p_provider_id, p_service_kinds);
$function$;

REVOKE ALL ON FUNCTION public.pas_admin_set_center_services(uuid,text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pas_admin_set_center_services(uuid,text[])
  TO authenticated;

-- Center owner can read its own active and archived service rows plus per-service intake policy.
CREATE OR REPLACE FUNCTION private.pas_my_center_service_policies()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_items jsonb;
BEGIN
  IF v_user IS NULL
     OR private.pas_role() IS DISTINCT FROM 'laboratory'
     OR NOT EXISTS (SELECT 1 FROM public.laboratory_profiles lp WHERE lp.id = v_user)
     OR NOT EXISTS (
       SELECT 1 FROM public.pas_medical_centers c
        WHERE c.profile_id = v_user AND c.is_active
     ) THEN
    RAISE EXCEPTION 'Active center account required' USING errcode = '42501';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'service_kind', s.service_kind,
        'service_active', s.is_active,
        'patient_requests_enabled', CASE WHEN s.is_active THEN coalesce(pol.patient_requests_enabled, false) ELSE false END,
        'updated_at', pol.updated_at
      ) ORDER BY s.service_kind
    ),
    '[]'::jsonb
  )
    INTO v_items
    FROM public.pas_provider_services s
    LEFT JOIN public.pas_center_service_policies pol
      ON pol.provider_id = s.provider_id AND pol.service_kind = s.service_kind
   WHERE s.provider_id = v_user;

  RETURN jsonb_build_object('items', v_items);
END;
$function$;

REVOKE ALL ON FUNCTION private.pas_my_center_service_policies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pas_my_center_service_policies() TO authenticated;

-- Serialize center policy changes with administrator capability changes using the same
-- center-row -> service/policy lock order. The exclusive row lock serializes policy toggles
-- with patient INSERT checks (FOR SHARE) and administrator capability changes (FOR UPDATE).
CREATE OR REPLACE FUNCTION private.pas_center_set_patient_request_policy(
  p_service_kind text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL
     OR private.pas_role() IS DISTINCT FROM 'laboratory'
     OR NOT EXISTS (SELECT 1 FROM public.laboratory_profiles lp WHERE lp.id = v_user) THEN
    RAISE EXCEPTION 'Center owner and matching active service required' USING errcode = '42501';
  END IF;

  PERFORM 1
    FROM public.pas_medical_centers c
   WHERE c.profile_id = v_user AND c.is_active
   FOR UPDATE;
  IF NOT FOUND OR NOT private.pas_center_accepts(v_user, p_service_kind) THEN
    RAISE EXCEPTION 'Center owner and matching active service required' USING errcode = '42501';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Explicit boolean policy required' USING errcode = '22023';
  END IF;

  INSERT INTO public.pas_center_service_policies(
    provider_id, service_kind, patient_requests_enabled, created_by, updated_by
  )
  VALUES (v_user, p_service_kind, p_enabled, v_user, v_user)
  ON CONFLICT (provider_id, service_kind)
  DO UPDATE SET
    patient_requests_enabled = EXCLUDED.patient_requests_enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user,
    'center.patient_requests.policy_changed',
    'pas_center_service_policies',
    v_user,
    jsonb_build_object('service_kind', p_service_kind, 'enabled', p_enabled)
  );

  RETURN jsonb_build_object(
    'provider_id', v_user,
    'service_kind', p_service_kind,
    'patient_requests_enabled', p_enabled
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.pas_center_set_patient_request_policy(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pas_center_set_patient_request_policy(text,boolean) TO authenticated;

-- Enforce the routing rule below all application RPCs. Doctor-origin requests are always
-- unassigned. Patient-origin requests can only be created for an active capability and policy.
CREATE OR REPLACE FUNCTION private.pas_guard_medical_request_provider_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.request_source = 'doctor' AND NEW.provider_id IS NOT NULL THEN
      RAISE EXCEPTION 'Doctors cannot select or assign a medical center; the patient must choose the provider.'
        USING errcode = '42501';
    END IF;

    IF NEW.request_source = 'patient' THEN
      IF v_actor IS NULL
         OR private.pas_role() IS DISTINCT FROM 'patient'
         OR v_actor IS DISTINCT FROM NEW.patient_id
         OR NEW.requested_by IS DISTINCT FROM NEW.patient_id
         OR NEW.doctor_id IS NOT NULL
         OR NEW.provider_id IS NULL THEN
        RAISE EXCEPTION 'Direct patient request must belong to the authenticated patient and an active center policy.'
          USING errcode = '42501';
      END IF;

      -- Share-locks the center identity so active-state changes and admin service updates wait for this request.
      PERFORM 1 FROM public.pas_medical_centers c
       WHERE c.profile_id = NEW.provider_id AND c.is_active
       FOR SHARE;
      IF NOT FOUND
         OR NOT private.pas_center_accepts(NEW.provider_id, NEW.service_kind)
         OR NOT EXISTS (
           SELECT 1 FROM public.pas_center_service_policies pol
            WHERE pol.provider_id = NEW.provider_id
              AND pol.service_kind = NEW.service_kind
              AND pol.patient_requests_enabled
         ) THEN
        RAISE EXCEPTION 'Direct patient request must belong to the authenticated patient and an active center policy.'
          USING errcode = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
    IF OLD.provider_id IS NOT NULL
       OR NEW.provider_id IS NULL
       OR OLD.request_source IS DISTINCT FROM 'doctor'
       OR NEW.request_source IS DISTINCT FROM 'doctor'
       OR OLD.status IS DISTINCT FROM 'requested'
       OR NEW.status IS DISTINCT FROM 'requested'
       OR v_actor IS NULL
       OR private.pas_role() IS DISTINCT FROM 'patient'
       OR v_actor IS DISTINCT FROM OLD.patient_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
       OR NEW.request_source IS DISTINCT FROM OLD.request_source
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR (to_jsonb(NEW) - 'provider_id') IS DISTINCT FROM (to_jsonb(OLD) - 'provider_id') THEN
      RAISE EXCEPTION 'Only the patient may assign an active compatible center to an unassigned doctor request.'
        USING errcode = '42501';
    END IF;

    -- Same lock order as admin capability updates: center row before service capability reads.
    -- FOR SHARE also conflicts with center active-state updates (NO KEY UPDATE).
    PERFORM 1 FROM public.pas_medical_centers c
     WHERE c.profile_id = NEW.provider_id AND c.is_active
     FOR SHARE;
    IF NOT FOUND OR NOT private.pas_center_accepts(NEW.provider_id, NEW.service_kind) THEN
      RAISE EXCEPTION 'Only the patient may assign an active compatible center to an unassigned doctor request.'
        USING errcode = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.pas_guard_medical_request_provider_assignment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pas_medical_request_provider_guard ON public.pas_medical_requests;
CREATE TRIGGER pas_medical_request_provider_guard
BEFORE INSERT OR UPDATE OF provider_id ON public.pas_medical_requests
FOR EACH ROW EXECUTE FUNCTION private.pas_guard_medical_request_provider_assignment();

-- Active-only provider directory. Centers can offer more than one service regardless of center_type.
CREATE OR REPLACE FUNCTION private.pas_search_service_providers(
  p_service_kind text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_query text := nullif(btrim(left(coalesce(p_query, ''), 100)), '');
  v_page integer := greatest(1, least(coalesce(p_page, 1), 10000));
  v_size integer := greatest(1, least(coalesce(p_page_size, 20), 50));
  v_total integer;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL OR private.pas_role() NOT IN ('patient','doctor') THEN
    RAISE EXCEPTION 'Authenticated patient or doctor required' USING errcode = '42501';
  END IF;

  IF p_service_kind IS NOT NULL
     AND p_service_kind NOT IN ('ct','mri','ecg','ultrasound','mammography','xray','physiotherapy','other') THEN
    RAISE EXCEPTION 'Unsupported service kind' USING errcode = '22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT
      c.profile_id AS provider_id,
      c.display_name,
      c.center_type,
      lp.license_number,
      coalesce((
        SELECT jsonb_agg(s.service_kind ORDER BY s.service_kind)
          FROM public.pas_provider_services s
         WHERE s.provider_id = c.profile_id AND s.is_active
      ), '[]'::jsonb) AS services,
      EXISTS (
        SELECT 1
          FROM public.pas_center_service_policies pol
         WHERE pol.provider_id = c.profile_id
           AND pol.patient_requests_enabled
           AND (p_service_kind IS NULL OR pol.service_kind = p_service_kind)
           AND private.pas_center_accepts(c.profile_id, pol.service_kind)
      ) AS supports_patient_requests,
      false AS supports_online_booking,
      NULL::text AS medical_license_number,
      NULL::text AS city,
      NULL::text AS address
    FROM public.pas_medical_centers c
    JOIN public.profiles p ON p.id = c.profile_id
    LEFT JOIN public.laboratory_profiles lp ON lp.id = c.profile_id
    WHERE p.role = 'laboratory'
      AND c.is_active
      AND c.center_type <> 'laboratory'
      AND EXISTS (
        SELECT 1 FROM public.pas_provider_services s
         WHERE s.provider_id = c.profile_id AND s.is_active
           AND (p_service_kind IS NULL OR s.service_kind = p_service_kind)
      )
      AND (v_query IS NULL OR c.display_name ILIKE '%' || v_query || '%' OR lp.license_number ILIKE '%' || v_query || '%')
  )
  SELECT count(*)::integer INTO v_total FROM candidates;

  WITH candidates AS MATERIALIZED (
    SELECT
      c.profile_id AS provider_id,
      c.display_name,
      c.center_type,
      lp.license_number,
      coalesce((
        SELECT jsonb_agg(s.service_kind ORDER BY s.service_kind)
          FROM public.pas_provider_services s
         WHERE s.provider_id = c.profile_id AND s.is_active
      ), '[]'::jsonb) AS services,
      EXISTS (
        SELECT 1
          FROM public.pas_center_service_policies pol
         WHERE pol.provider_id = c.profile_id
           AND pol.patient_requests_enabled
           AND (p_service_kind IS NULL OR pol.service_kind = p_service_kind)
           AND private.pas_center_accepts(c.profile_id, pol.service_kind)
      ) AS supports_patient_requests,
      false AS supports_online_booking,
      NULL::text AS medical_license_number,
      NULL::text AS city,
      NULL::text AS address
    FROM public.pas_medical_centers c
    JOIN public.profiles p ON p.id = c.profile_id
    LEFT JOIN public.laboratory_profiles lp ON lp.id = c.profile_id
    WHERE p.role = 'laboratory'
      AND c.is_active
      AND c.center_type <> 'laboratory'
      AND EXISTS (
        SELECT 1 FROM public.pas_provider_services s
         WHERE s.provider_id = c.profile_id AND s.is_active
           AND (p_service_kind IS NULL OR s.service_kind = p_service_kind)
      )
      AND (v_query IS NULL OR c.display_name ILIKE '%' || v_query || '%' OR lp.license_number ILIKE '%' || v_query || '%')
  )
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.display_name, x.provider_id), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT * FROM candidates
       ORDER BY display_name, provider_id
       LIMIT v_size OFFSET ((v_page - 1) * v_size)
    ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'page', v_page, 'page_size', v_size);
END;
$function$;

CREATE OR REPLACE FUNCTION private.pas_service_providers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.display_name, q.provider_id), '[]'::jsonb)
    FROM (
      SELECT
        c.profile_id AS provider_id,
        c.display_name,
        c.center_type,
        coalesce((
          SELECT jsonb_agg(s.service_kind ORDER BY s.service_kind)
            FROM public.pas_provider_services s
           WHERE s.provider_id = c.profile_id AND s.is_active
        ), '[]'::jsonb) AS services,
        lp.license_number AS license_number,
        NULL::text AS medical_license_number,
        NULL::text AS city,
        NULL::text AS address,
        false AS supports_online_booking,
        EXISTS (
          SELECT 1 FROM public.pas_center_service_policies pol
           WHERE pol.provider_id = c.profile_id AND pol.patient_requests_enabled
             AND private.pas_center_accepts(c.profile_id, pol.service_kind)
        ) AS supports_patient_requests
      FROM public.pas_medical_centers c
      JOIN public.profiles p ON p.id = c.profile_id
      LEFT JOIN public.laboratory_profiles lp ON lp.id = c.profile_id
      WHERE auth.uid() IS NOT NULL
        AND p.role = 'laboratory'
        AND c.is_active
        AND c.center_type <> 'laboratory'
        AND EXISTS (
          SELECT 1 FROM public.pas_provider_services s
           WHERE s.provider_id = c.profile_id AND s.is_active
        )
      ORDER BY c.display_name, c.profile_id
      LIMIT 200
    ) q;
$function$;

-- Keep access to already assigned work and historical results even after a service is disabled.
CREATE OR REPLACE FUNCTION private.pas_center_worklist(
  p_request uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_status text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH visible AS MATERIALIZED (
    SELECT r.*, p.full_name AS patient_name, d.full_name AS doctor_name
      FROM public.pas_medical_requests r
      JOIN public.profiles p ON p.id = r.patient_id
      LEFT JOIN public.profiles d ON d.id = r.doctor_id
     WHERE r.provider_id = auth.uid()
       AND private.pas_role() = 'laboratory'
       AND private.pas_center_has_service(r.provider_id, r.service_kind)
  ),
  filtered AS MATERIALIZED (
    SELECT * FROM visible
     WHERE (p_request IS NULL OR id = p_request)
       AND (p_status IS NULL OR status = p_status)
       AND (p_query IS NULL OR patient_name ILIKE '%' || left(p_query,100) || '%' OR service_name ILIKE '%' || left(p_query,100) || '%')
       AND (p_from IS NULL OR coalesce(scheduled_at,patient_preferred_at,doctor_preferred_at,requested_at) >= p_from)
       AND (p_to IS NULL OR coalesce(scheduled_at,patient_preferred_at,doctor_preferred_at,requested_at) < p_to)
  ),
  paged AS (
    SELECT * FROM filtered
     ORDER BY requested_at DESC, id
     LIMIT CASE WHEN p_request IS NOT NULL THEN 1 WHEN p_from IS NOT NULL THEN 500 ELSE 20 END
     OFFSET CASE WHEN p_request IS NOT NULL OR p_from IS NOT NULL THEN 0 ELSE (greatest(1,least(coalesce(p_page,1),10000))-1)*20 END
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'counts', (
      SELECT coalesce(jsonb_object_agg(status,n), '{}'::jsonb)
        FROM (SELECT status,count(*) n FROM visible GROUP BY status) c
    ),
    'items', (
      SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.requested_at DESC, q.id), '[]'::jsonb)
        FROM (
          SELECT r.*,
            coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
                        FROM public.pas_medical_results x WHERE x.request_id = r.id),'[]'::jsonb) AS pas_medical_results,
            coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.session_number)
                        FROM public.pas_therapy_sessions t WHERE t.request_id = r.id),'[]'::jsonb) AS pas_therapy_sessions
          FROM paged r
        ) q
    )
  );
$function$;

-- Current service directory remains public through the existing authenticated wrappers only.
REVOKE ALL ON FUNCTION private.pas_search_service_providers(text,text,integer,integer), private.pas_service_providers()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pas_search_service_providers(text,text,integer,integer), private.pas_service_providers()
  TO authenticated;

-- RLS: active service declarations are visible in the directory; assigned work/history remains readable.
ALTER POLICY pas_medical_center_boundary ON public.pas_medical_requests
  USING (
    private.pas_role() IS DISTINCT FROM 'laboratory'
    OR ((SELECT auth.uid()) = provider_id AND private.pas_center_has_service(provider_id, service_kind))
  );

ALTER POLICY pas_medical_result_center_boundary ON public.pas_medical_results
  USING (
    private.pas_role() IS DISTINCT FROM 'laboratory'
    OR EXISTS (
      SELECT 1 FROM public.pas_medical_requests r
       WHERE r.id = pas_medical_results.request_id
         AND r.provider_id = (SELECT auth.uid())
         AND private.pas_center_has_service(r.provider_id, r.service_kind)
    )
  );

ALTER POLICY pas_therapy_read ON public.pas_therapy_sessions
  USING (
    patient_id = (SELECT auth.uid())
    OR private.pas_can_read(patient_id, 'diagnostics')
    OR (
      provider_id = (SELECT auth.uid())
      AND private.pas_center_has_service(provider_id, 'physiotherapy')
    )
  );

ALTER POLICY pas_provider_read ON public.pas_provider_services
  USING (private.pas_center_accepts(provider_id, service_kind));

COMMIT;
