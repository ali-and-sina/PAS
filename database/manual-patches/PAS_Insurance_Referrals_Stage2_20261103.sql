-- PAS — Insurance prescriptions & multi-provider referrals (Stage 2)
-- Date: 2026-11-03
-- Purpose:
--   1) Add owner-scoped patient/doctor read APIs for insurer prescriptions.
--   2) Add patient-only issuance/revocation of short-lived referral QR tokens.
--   3) Enforce expiry and provider-membership invariants inside PostgreSQL.
--
-- IMPORTANT:
--   This manual patch targets the already-provisioned Stage-1 schema. It adds scoped
--   RPCs/triggers and replaces the existing provider QR issue/resolve routines with a
--   consistent lock order. It does not create/alter tables, roles, direct table grants
--   or existing RLS policies. Apply only after reconciling the exact Stage-1 migrations
--   in the canonical repository and reviewing the target schema/migration history.

begin;

-- Fail closed if the target database is not the expected insurer-referral Stage-1 shape.
do $preflight$
begin
  if to_regclass('public.pas_insurance_prescriptions') is null
     or to_regclass('public.pas_insurance_prescription_items') is null
     or to_regclass('public.pas_execution_referrals') is null
     or to_regclass('public.pas_execution_referral_items') is null
     or to_regclass('public.pas_referral_qr_tokens') is null
     or to_regclass('public.pas_provider_memberships') is null
     or to_regclass('public.pas_service_catalog') is null
     or to_regclass('public.pas_referral_results') is null
     or to_regclass('public.pas_referral_events') is null
     or to_regclass('public.pas_provider_registry') is null
     or to_regclass('public.pas_referral_lab_values') is null
     or to_regclass('public.pas_referral_imaging_reports') is null
     or to_regclass('public.pas_referral_pharmacy_dispenses') is null
     or to_regclass('public.pas_referral_service_results') is null then
    raise exception 'PAS insurer-referral Stage-1 tables are missing; restore and apply the exact Stage-1 migrations first';
  end if;
  if to_regprocedure('private.pas_can_read(uuid,text)') is null
     or to_regprocedure('private.pas_is_provider_member(uuid)') is null
     or to_regprocedure('private.pas_is_provider_operator(uuid)') is null
     or to_regprocedure('public.pas_issue_referral_qr_token(uuid,text,timestamp with time zone)') is null
     or to_regprocedure('public.pas_resolve_referral_qr_token(text)') is null
     or to_regprocedure('private.pas_respond_to_referral(uuid,text,text)') is null
     or to_regprocedure('private.pas_update_referral_item(uuid,text,numeric,text)') is null then
    raise exception 'Required PAS access-control helpers or provider QR RPC wrappers are missing; do not apply this patch to a drifted database';
  end if;
  if exists (
    select 1
    from public.pas_provider_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.status = 'active' and p.role = 'patient'
  ) then
    raise exception 'Active patient provider memberships exist; resolve them through an audited admin workflow before applying this patch';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- Scope helper: map an insurer catalog group to the existing patient-record scope.
-- Unknown/unmapped groups intentionally return false for physician access.
-- ---------------------------------------------------------------------------
create or replace function private.pas_can_read_insurance_service(
  p_patient_id uuid,
  p_service_group text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case p_service_group
    when 'laboratory' then private.pas_can_read(p_patient_id, 'labs')
    when 'medication' then private.pas_can_read(p_patient_id, 'medications')
    when 'imaging' then private.pas_can_read(p_patient_id, 'diagnostics')
    when 'therapy' then private.pas_can_read(p_patient_id, 'diagnostics')
    when 'other' then private.pas_can_read(p_patient_id, 'diagnostics')
    else false
  end;
$function$;

revoke all on function private.pas_can_read_insurance_service(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patient view: own matched insurer prescriptions, their items and referrals.
-- No raw payload, national ID, phone, token hash or token value is returned.
-- ---------------------------------------------------------------------------
create or replace function private.pas_get_patient_insurance_prescriptions(
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 50));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  v_ids uuid[] := '{}'::uuid[];
  v_result jsonb;
begin
  if v_actor is null
     or not exists (
       select 1 from public.profiles p
       where p.id = v_actor and p.role = 'patient'
     )
     or not exists (
       select 1 from public.patient_profiles pp where pp.id = v_actor
     ) then
    raise exception 'Patient authentication required' using errcode = '42501';
  end if;

  with visible as materialized (
    select rx.*,
      (rx.expires_at is not null and rx.expires_at <= now()) as is_expired
    from public.pas_insurance_prescriptions rx
    where rx.patient_id = v_actor
      and rx.identity_match_status = 'matched'
  ),
  page as materialized (
    select * from visible
    order by source_received_at desc, id desc
    limit v_limit offset v_offset
  )
  select
    coalesce(array_agg(q.id), '{}'::uuid[]),
    jsonb_build_object(
      'total', (select count(*) from visible),
      'limit', v_limit,
      'offset', v_offset,
      'items', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'payer_key', q.payer_key,
            'external_prescription_id', q.external_prescription_id,
            'external_tracking_number', q.external_tracking_number,
            'source_message_version', q.source_message_version,
            'source_received_at', q.source_received_at,
            'issued_at', q.issued_at,
            'expires_at', q.expires_at,
            'is_expired', q.is_expired,
            'status', q.status,
            'supersedes_prescription_id', q.supersedes_prescription_id,
            'items', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', pi.id,
                    'line_number', pi.line_number,
                    'item_kind', pi.item_kind,
                    'display', pi.external_display,
                    'quantity', pi.quantity,
                    'unit', pi.unit_label,
                    'item_status', pi.item_status,
                    'mapping_status', pi.mapping_status,
                    'service_code', sc.service_code,
                    'service_group', sc.service_group,
                    'service_display', sc.display_name
                  ) order by pi.line_number, pi.id
                ), '[]'::jsonb
              )
              from public.pas_insurance_prescription_items pi
              left join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
              where pi.prescription_id = q.id
            ),
            'referrals', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'referral_id', er.id,
                    'status', er.status,
                    'provider', jsonb_build_object(
                      'display_name', pr.display_name,
                      'provider_kind', pr.provider_kind
                    ),
                    'provider_admission_reference', er.provider_admission_reference,
                    'provider_admission_at', er.provider_admission_at,
                    'assigned_at', er.assigned_at,
                    'accepted_at', er.accepted_at,
                    'started_at', er.started_at,
                    'completed_at', er.completed_at,
                    'result_submitted_at', er.result_submitted_at,
                    'finalized_at', er.finalized_at,
                    'active_qr_expires_at', (
                      select max(qt.expires_at)
                      from public.pas_referral_qr_tokens qt
                      where qt.referral_id = er.id
                        and qt.revoked_at is null
                        and qt.expires_at > now()
                        and q.status not in ('cancelled', 'rejected')
                        and er.status not in ('rejected', 'cancelled', 'finalized')
                        and (q.expires_at is null or q.expires_at > now())
                    ),
                    'items', (
                      select coalesce(
                        jsonb_agg(
                          jsonb_build_object(
                            'referral_item_id', ri.id,
                            'prescription_item_id', pi.id,
                            'line_number', pi.line_number,
                            'item_kind', pi.item_kind,
                            'display', pi.external_display,
                            'quantity', pi.quantity,
                            'unit', pi.unit_label,
                            'item_status', ri.item_status,
                            'completed_quantity', ri.completed_quantity,
                            'service_group', sc.service_group
                          ) order by pi.line_number, pi.id
                        ), '[]'::jsonb
                      )
                      from public.pas_execution_referral_items ri
                      join public.pas_insurance_prescription_items pi
                        on pi.id = ri.prescription_item_id
                       and pi.prescription_id = ri.prescription_id
                      left join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
                      where ri.referral_id = er.id
                    ),
                    'results', (
                      select coalesce(
                        jsonb_agg(
                          jsonb_build_object(
                            'result_id', rr.id,
                            'result_kind', rr.result_kind,
                            'version_number', rr.version_number,
                            'status', rr.status,
                            'performed_at', rr.performed_at,
                            'finalized_at', rr.finalized_at,
                            'published_at', rr.published_at
                          ) order by rr.published_at desc, rr.id desc
                        ), '[]'::jsonb
                      )
                      from public.pas_referral_results rr
                      where rr.referral_id = er.id
                        and rr.status in ('final', 'amended')
                        and rr.published_at is not null
                        and not exists (
                          select 1 from public.pas_referral_results later
                          where later.result_chain_id = rr.result_chain_id
                            and later.version_number > rr.version_number
                            and later.status in ('final', 'amended', 'retracted')
                        )
                    )
                  ) order by er.assigned_at desc, er.id
                ), '[]'::jsonb
              )
              from public.pas_execution_referrals er
              join public.pas_provider_registry pr on pr.id = er.provider_id
              where er.prescription_id = q.id
            )
          ) order by q.source_received_at desc, q.id desc
        ), '[]'::jsonb
      )
    )
  into v_ids, v_result
  from page q;

  -- Audit list access without recording medical values or raw insurer identifiers.
  insert into public.pas_referral_events(
    prescription_id, event_type, actor_profile_id, actor_kind, metadata
  )
  select e.prescription_id, 'patient.prescription.listed', v_actor, 'patient',
    jsonb_build_object('channel', 'patient_insurance_prescriptions_rpc')
  from unnest(v_ids) as e(prescription_id);

  return coalesce(v_result, jsonb_build_object(
    'total', 0, 'limit', v_limit, 'offset', v_offset, 'items', '[]'::jsonb
  ));
end;
$function$;

revoke all on function private.pas_get_patient_insurance_prescriptions(integer, integer) from public, anon, authenticated;

-- Authenticated-only SECURITY DEFINER gateway. The private routine enforces patient ownership.
create or replace function public.pas_get_patient_insurance_prescriptions(
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.pas_get_patient_insurance_prescriptions(p_limit, p_offset);
$function$;

revoke all on function public.pas_get_patient_insurance_prescriptions(integer, integer) from public, anon, authenticated;
grant execute on function public.pas_get_patient_insurance_prescriptions(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Doctor view: only items covered by the patient's current, verified record
-- access scopes. The helper checks verified doctor + active relationship +
-- unexpired pas_record_access grant for each individual item group.
-- ---------------------------------------------------------------------------
create or replace function private.pas_get_doctor_patient_insurance_prescriptions(
  p_patient_id uuid,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 20));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  v_can_labs boolean := false;
  v_can_medications boolean := false;
  v_can_diagnostics boolean := false;
  v_ids uuid[] := '{}'::uuid[];
  v_result jsonb;
begin
  if v_actor is null
     or not exists (
       select 1
       from public.profiles p
       join public.doctor_profiles d on d.id = p.id
       where p.id = v_actor and p.role = 'doctor' and d.is_verified
     ) then
    raise exception 'Verified physician authentication required' using errcode = '42501';
  end if;

  v_can_labs := private.pas_can_read(p_patient_id, 'labs');
  v_can_medications := private.pas_can_read(p_patient_id, 'medications');
  v_can_diagnostics := private.pas_can_read(p_patient_id, 'diagnostics');

  if not (v_can_labs or v_can_medications or v_can_diagnostics) then
    return jsonb_build_object(
      'scope_available', false, 'total', 0, 'limit', v_limit,
      'offset', v_offset, 'items', '[]'::jsonb
    );
  end if;

  with visible as materialized (
    select rx.*,
      (rx.expires_at is not null and rx.expires_at <= now()) as is_expired,
      (select count(*) from public.pas_insurance_prescription_items all_pi
       where all_pi.prescription_id = rx.id and all_pi.item_status = 'active') as active_item_count,
      (select count(*)
       from public.pas_insurance_prescription_items pi
       join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
       where pi.prescription_id = rx.id and pi.item_status = 'active'
         and private.pas_can_read_insurance_service(p_patient_id, sc.service_group)
      ) as visible_active_item_count
    from public.pas_insurance_prescriptions rx
    where rx.patient_id = p_patient_id
      and rx.identity_match_status = 'matched'
      and exists (
        select 1
        from public.pas_insurance_prescription_items pi
        join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
        where pi.prescription_id = rx.id and pi.item_status = 'active'
          and private.pas_can_read_insurance_service(p_patient_id, sc.service_group)
      )
  ),
  page as materialized (
    select * from visible
    order by source_received_at desc, id desc
    limit v_limit offset v_offset
  )
  select
    coalesce(array_agg(q.id), '{}'::uuid[]),
    jsonb_build_object(
      'scope_available', true,
      'total', (select count(*) from visible),
      'limit', v_limit,
      'offset', v_offset,
      'items', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'payer_key', q.payer_key,
            'external_prescription_id', case when q.active_item_count = q.visible_active_item_count then q.external_prescription_id else null end,
            'external_tracking_number', case when q.active_item_count = q.visible_active_item_count then q.external_tracking_number else null end,
            'source_received_at', q.source_received_at,
            'issued_at', q.issued_at,
            'expires_at', q.expires_at,
            'is_expired', q.is_expired,
            'status', case
              when q.active_item_count = q.visible_active_item_count then q.status
              else null
            end,
            'items', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', pi.id,
                    'line_number', pi.line_number,
                    'item_kind', pi.item_kind,
                    'display', pi.external_display,
                    'quantity', pi.quantity,
                    'unit', pi.unit_label,
                    'item_status', pi.item_status,
                    'mapping_status', pi.mapping_status,
                    'service_code', sc.service_code,
                    'service_group', sc.service_group,
                    'service_display', sc.display_name
                  ) order by pi.line_number, pi.id
                ), '[]'::jsonb
              )
              from public.pas_insurance_prescription_items pi
              join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
              where pi.prescription_id = q.id
                and private.pas_can_read_insurance_service(p_patient_id, sc.service_group)
            ),
            'referrals', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'referral_id', er.id,
                    'status', case
                      when (
                        select count(*)
                        from public.pas_execution_referral_items all_ri
                        where all_ri.referral_id = er.id
                      ) = (
                        select count(*)
                        from public.pas_execution_referral_items visible_ri
                        join public.pas_insurance_prescription_items visible_pi
                          on visible_pi.id = visible_ri.prescription_item_id
                        join public.pas_service_catalog visible_sc
                          on visible_sc.id = visible_pi.service_catalog_id
                        where visible_ri.referral_id = er.id
                          and private.pas_can_read_insurance_service(p_patient_id, visible_sc.service_group)
                      ) then er.status
                      else null
                    end,
                    'provider', jsonb_build_object(
                      'display_name', pr.display_name,
                      'provider_kind', pr.provider_kind
                    ),
                    'assigned_at', er.assigned_at,
                    'accepted_at', er.accepted_at,
                    'started_at', er.started_at,
                    'completed_at', er.completed_at,
                    'result_submitted_at', er.result_submitted_at,
                    'finalized_at', er.finalized_at,
                    'items', (
                      select coalesce(
                        jsonb_agg(
                          jsonb_build_object(
                            'referral_item_id', ri.id,
                            'prescription_item_id', pi.id,
                            'line_number', pi.line_number,
                            'item_kind', pi.item_kind,
                            'display', pi.external_display,
                            'quantity', pi.quantity,
                            'unit', pi.unit_label,
                            'item_status', ri.item_status,
                            'completed_quantity', ri.completed_quantity,
                            'service_group', sc.service_group
                          ) order by pi.line_number, pi.id
                        ), '[]'::jsonb
                      )
                      from public.pas_execution_referral_items ri
                      join public.pas_insurance_prescription_items pi
                        on pi.id = ri.prescription_item_id
                       and pi.prescription_id = ri.prescription_id
                      join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
                      where ri.referral_id = er.id
                        and private.pas_can_read_insurance_service(p_patient_id, sc.service_group)
                    ),
                    'results', (
                      select coalesce(
                        jsonb_agg(
                          jsonb_build_object(
                            'result_id', rr.id,
                            'result_kind', rr.result_kind,
                            'version_number', rr.version_number,
                            'status', rr.status,
                            'performed_at', rr.performed_at,
                            'finalized_at', rr.finalized_at,
                            'published_at', rr.published_at
                          ) order by rr.published_at desc, rr.id desc
                        ), '[]'::jsonb
                      )
                      from public.pas_referral_results rr
                      where rr.referral_id = er.id
                        and rr.status in ('final', 'amended')
                        and rr.published_at is not null
                        and private.pas_can_read_insurance_service(
                          p_patient_id,
                          case rr.result_kind
                            when 'pharmacy' then 'medication'
                            else rr.result_kind
                          end
                        )
                        and not exists (
                          select 1 from public.pas_referral_results later
                          where later.result_chain_id = rr.result_chain_id
                            and later.version_number > rr.version_number
                            and later.status in ('final', 'amended', 'retracted')
                        )
                        and exists (
                          select 1
                          from public.pas_execution_referral_items ri2
                          join public.pas_insurance_prescription_items pi2
                            on pi2.id = ri2.prescription_item_id
                           and pi2.prescription_id = ri2.prescription_id
                          join public.pas_service_catalog sc2 on sc2.id = pi2.service_catalog_id
                          where ri2.referral_id = er.id
                            and sc2.service_group = case rr.result_kind
                              when 'pharmacy' then 'medication'
                              else rr.result_kind
                            end
                            and private.pas_can_read_insurance_service(p_patient_id, sc2.service_group)
                        )
                    )
                  ) order by er.assigned_at desc, er.id
                ), '[]'::jsonb
              )
              from public.pas_execution_referrals er
              join public.pas_provider_registry pr on pr.id = er.provider_id
              where er.prescription_id = q.id
                and exists (
                  select 1
                  from public.pas_execution_referral_items ri
                  join public.pas_insurance_prescription_items pi on pi.id = ri.prescription_item_id
                  join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
                  where ri.referral_id = er.id
                    and private.pas_can_read_insurance_service(p_patient_id, sc.service_group)
                )
            )
          ) order by q.source_received_at desc, q.id desc
        ), '[]'::jsonb
      )
    )
  into v_ids, v_result
  from page q;

  insert into public.pas_referral_events(
    prescription_id, event_type, actor_profile_id, actor_kind, metadata
  )
  select e.prescription_id, 'doctor.insurance_prescription.viewed', v_actor, 'doctor',
    jsonb_build_object('channel', 'doctor_patient_insurance_prescriptions_rpc')
  from unnest(v_ids) as e(prescription_id);

  return coalesce(v_result, jsonb_build_object(
    'scope_available', true, 'total', 0, 'limit', v_limit,
    'offset', v_offset, 'items', '[]'::jsonb
  ));
end;
$function$;

revoke all on function private.pas_get_doctor_patient_insurance_prescriptions(uuid, integer, integer) from public, anon, authenticated;

-- Authenticated-only SECURITY DEFINER gateway. The private routine enforces doctor/patient scopes.
create or replace function public.pas_get_doctor_patient_insurance_prescriptions(
  p_patient_id uuid,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.pas_get_doctor_patient_insurance_prescriptions(p_patient_id, p_limit, p_offset);
$function$;

revoke all on function public.pas_get_doctor_patient_insurance_prescriptions(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.pas_get_doctor_patient_insurance_prescriptions(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Doctor result detail: current published result only; each clinical section
-- is filtered again by the relevant active patient-record scope.
-- ---------------------------------------------------------------------------
create or replace function private.pas_get_doctor_insurance_result_detail(
  p_result_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_patient_id uuid;
  v_prescription_id uuid;
  v_referral_id uuid;
  v_result public.pas_referral_results%rowtype;
  v_payload jsonb;
begin
  if v_actor is null
     or not exists (
       select 1 from public.profiles p
       join public.doctor_profiles d on d.id = p.id
       where p.id = v_actor and p.role = 'doctor' and d.is_verified
     ) then
    raise exception 'Verified physician authentication required' using errcode = '42501';
  end if;

  select rr.* into v_result
  from public.pas_referral_results rr
  join public.pas_execution_referrals er on er.id = rr.referral_id
  join public.pas_insurance_prescriptions rx on rx.id = er.prescription_id
  where rr.id = p_result_id
    and rr.status in ('final', 'amended')
    and rr.published_at is not null
    and rx.identity_match_status = 'matched'
    and not exists (
      select 1 from public.pas_referral_results later
      where later.result_chain_id = rr.result_chain_id
        and later.version_number > rr.version_number
        and later.status in ('final', 'amended', 'retracted')
    );
  if not found then
    raise exception 'Published result is not available' using errcode = 'P0002';
  end if;

  select er.prescription_id, rx.patient_id, er.id
  into v_prescription_id, v_patient_id, v_referral_id
  from public.pas_execution_referrals er
  join public.pas_insurance_prescriptions rx on rx.id = er.prescription_id
  where er.id = v_result.referral_id
    and rx.identity_match_status = 'matched';
  if not found then
    raise exception 'Published result is not available' using errcode = 'P0002';
  end if;

  if not (
    case v_result.result_kind
      when 'laboratory' then private.pas_can_read(v_patient_id, 'labs')
      when 'pharmacy' then private.pas_can_read(v_patient_id, 'medications')
      when 'imaging' then private.pas_can_read(v_patient_id, 'diagnostics')
      when 'therapy' then private.pas_can_read(v_patient_id, 'diagnostics')
      when 'other' then private.pas_can_read(v_patient_id, 'diagnostics')
      else false
    end
  ) or not exists (
    select 1
    from public.pas_execution_referral_items ri
    join public.pas_insurance_prescription_items pi on pi.id = ri.prescription_item_id
    join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
    where ri.referral_id = v_referral_id
      and private.pas_can_read_insurance_service(
        v_patient_id,
        case v_result.result_kind when 'pharmacy' then 'medication' else v_result.result_kind end
      )
      and sc.service_group = case v_result.result_kind
        when 'pharmacy' then 'medication'
        when 'laboratory' then 'laboratory'
        when 'imaging' then 'imaging'
        when 'therapy' then 'therapy'
        when 'other' then 'other'
        else '__not_allowed__'
      end
  ) then
    raise exception 'Published result is not available in the current patient-record scope' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'result_id', v_result.id,
    'result_kind', v_result.result_kind,
    'version_number', v_result.version_number,
    'performed_at', v_result.performed_at,
    'finalized_at', v_result.finalized_at,
    'provider', jsonb_build_object(
      'display_name', pr.display_name,
      'provider_kind', pr.provider_kind
    ),
    'laboratory_values', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'test_name', td.name,
            'test_name_fa', td.name_fa,
            'value_numeric', lv.value_numeric,
            'value_text', lv.value_text,
            'value_boolean', lv.value_boolean,
            'unit', lv.unit,
            'reference_min', lv.reference_min,
            'reference_max', lv.reference_max,
            'reference_text', lv.reference_text,
            'abnormal_flag', lv.abnormal_flag,
            'value_status', lv.value_status,
            'observed_at', lv.observed_at
          ) order by lv.observed_at, lv.id
        ), '[]'::jsonb
      )
      from public.pas_referral_lab_values lv
      join public.pas_execution_referral_items ri on ri.id = lv.referral_item_id
      join public.pas_insurance_prescription_items pi on pi.id = ri.prescription_item_id
      join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
      join public.test_definitions td on td.id = lv.test_definition_id
      where lv.result_id = v_result.id
        and ri.referral_id = v_referral_id
        and v_result.result_kind = 'laboratory'
        and lv.value_status <> 'superseded'
        and sc.service_group = 'laboratory'
        and private.pas_can_read(v_patient_id, 'labs')
    ),
    'imaging_report', case
      when v_result.result_kind = 'imaging'
       and private.pas_can_read(v_patient_id, 'diagnostics')
       and exists (
         select 1
         from public.pas_execution_referral_items ri
         join public.pas_insurance_prescription_items pi on pi.id = ri.prescription_item_id
         join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
         where ri.referral_id = v_referral_id and sc.service_group = 'imaging'
       ) then (
         select jsonb_build_object(
           'report_text', ir.report_text,
           'findings', ir.findings,
           'impression', ir.impression,
           'images_available', ir.image_storage_path is not null
         )
         from public.pas_referral_imaging_reports ir
         where ir.result_id = v_result.id
       )
      else null
    end,
    'pharmacy_dispenses', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'item', pi.external_display,
            'dispense_status', pd.dispense_status,
            'prescribed_quantity', pd.prescribed_quantity,
            'dispensed_quantity', pd.dispensed_quantity,
            'substitute_display', pd.substitute_display,
            'not_dispensed_reason', pd.not_dispensed_reason,
            'dispensed_at', pd.dispensed_at
          ) order by pi.line_number, pd.id
        ), '[]'::jsonb
      )
      from public.pas_referral_pharmacy_dispenses pd
      join public.pas_execution_referral_items ri on ri.id = pd.referral_item_id
      join public.pas_insurance_prescription_items pi on pi.id = ri.prescription_item_id
      join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
      where pd.result_id = v_result.id
        and ri.referral_id = v_referral_id
        and v_result.result_kind = 'pharmacy'
        and sc.service_group = 'medication'
        and private.pas_can_read(v_patient_id, 'medications')
    ),
    'service_results', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'service_group', sr.service_group,
            'data', sr.structured_data
          ) order by sr.created_at, sr.id
        ), '[]'::jsonb
      )
      from public.pas_referral_service_results sr
      join public.pas_execution_referral_items ri on ri.id = sr.referral_item_id
      join public.pas_insurance_prescription_items pi on pi.id = ri.prescription_item_id
      join public.pas_service_catalog sc on sc.id = pi.service_catalog_id
      where sr.result_id = v_result.id
        and ri.referral_id = v_referral_id
        and v_result.result_kind in ('therapy', 'other')
        and sr.service_group = sc.service_group
        and sc.service_group in ('therapy', 'other')
        and private.pas_can_read(v_patient_id, 'diagnostics')
    )
  ) into v_payload
  from public.pas_provider_registry pr
  where pr.id = v_result.provider_id;

  if v_payload is null then
    raise exception 'Published result details are not available' using errcode = 'P0002';
  end if;

  insert into public.pas_referral_events(
    prescription_id, referral_id, result_id, event_type,
    actor_profile_id, actor_kind, metadata
  ) values (
    v_prescription_id, v_referral_id, p_result_id,
    'doctor.result.viewed', v_actor, 'doctor',
    jsonb_build_object('channel', 'doctor_insurance_result_detail_rpc')
  );

  return v_payload;
end;
$function$;

revoke all on function private.pas_get_doctor_insurance_result_detail(uuid) from public, anon, authenticated;

-- Authenticated-only SECURITY DEFINER gateway. Result payload is filtered per active record scope.
create or replace function public.pas_get_doctor_insurance_result_detail(p_result_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.pas_get_doctor_insurance_result_detail(p_result_id);
$function$;

revoke all on function public.pas_get_doctor_insurance_result_detail(uuid) from public, anon, authenticated;
grant execute on function public.pas_get_doctor_insurance_result_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Patient-only referral QR issuance/revocation. Token hash only is persisted;
-- raw token is generated and returned once by the server action.
-- ---------------------------------------------------------------------------
create or replace function private.pas_patient_issue_referral_qr_token(
  p_referral_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_prescription public.pas_insurance_prescriptions%rowtype;
  v_referral public.pas_execution_referrals%rowtype;
  v_token_id uuid;
  v_prescription_id uuid;
begin
  if v_actor is null
     or not exists (
       select 1 from public.profiles p
       join public.patient_profiles pp on pp.id = p.id
       where p.id = v_actor and p.role = 'patient'
     ) then
    raise exception 'Patient authentication required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid QR token hash' using errcode = '22023';
  end if;
  if p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '30 minutes' then
    raise exception 'Patient referral QR validity must not exceed 30 minutes' using errcode = '22023';
  end if;

  select er.prescription_id into v_prescription_id
  from public.pas_execution_referrals er
  where er.id = p_referral_id;
  if not found then
    raise exception 'Referral not found' using errcode = 'P0002';
  end if;

  select rx.* into v_prescription
  from public.pas_insurance_prescriptions rx
  where rx.id = v_prescription_id
  for update;
  if not found
     or v_prescription.patient_id is distinct from v_actor
     or v_prescription.identity_match_status <> 'matched'
     or v_prescription.status in ('cancelled', 'rejected') then
    raise exception 'Referral does not belong to the signed-in patient' using errcode = '42501';
  end if;
  if v_prescription.expires_at is not null and v_prescription.expires_at <= clock_timestamp() then
    raise exception 'Insurance prescription has expired' using errcode = '23514';
  end if;

  select er.* into v_referral
  from public.pas_execution_referrals er
  where er.id = p_referral_id
    and er.prescription_id = v_prescription.id
  for update;
  if not found or v_referral.status not in ('assigned', 'accepted', 'in_progress', 'partially_completed') then
    raise exception 'Referral is not eligible for patient QR issuance' using errcode = '23514';
  end if;

  update public.pas_referral_qr_tokens
  set revoked_at = now()
  where referral_id = p_referral_id
    and revoked_at is null
    and expires_at > now();

  insert into public.pas_referral_qr_tokens(
    referral_id, token_hash, issued_by, expires_at
  ) values (
    p_referral_id, p_token_hash, v_actor, p_expires_at
  ) returning id into v_token_id;

  insert into public.pas_referral_events(
    prescription_id, referral_id, event_type,
    actor_profile_id, actor_kind, metadata
  ) values (
    v_prescription.id, p_referral_id, 'qr.patient_issued',
    v_actor, 'patient', jsonb_build_object('token_id', v_token_id, 'expires_at', p_expires_at)
  );

  return v_token_id;
end;
$function$;

revoke all on function private.pas_patient_issue_referral_qr_token(uuid, text, timestamptz) from public, anon, authenticated;

-- Authenticated-only SECURITY DEFINER gateway. Only the patient who owns the parent RX may issue.
create or replace function public.pas_patient_issue_referral_qr_token(
  p_referral_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language sql
security definer
set search_path = ''
as $function$
  select private.pas_patient_issue_referral_qr_token(p_referral_id, p_token_hash, p_expires_at);
$function$;

revoke all on function public.pas_patient_issue_referral_qr_token(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pas_patient_issue_referral_qr_token(uuid, text, timestamptz) to authenticated;

create or replace function private.pas_patient_revoke_referral_qr_token(
  p_referral_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_prescription public.pas_insurance_prescriptions%rowtype;
  v_count integer := 0;
begin
  if v_actor is null
     or not exists (
       select 1 from public.profiles p
       join public.patient_profiles pp on pp.id = p.id
       where p.id = v_actor and p.role = 'patient'
     ) then
    raise exception 'Patient authentication required' using errcode = '42501';
  end if;

  select rx.* into v_prescription
  from public.pas_insurance_prescriptions rx
  join public.pas_execution_referrals er on er.prescription_id = rx.id
  where er.id = p_referral_id
  for update of rx;
  if not found
     or v_prescription.patient_id is distinct from v_actor
     or v_prescription.identity_match_status <> 'matched' then
    raise exception 'Referral does not belong to the signed-in patient' using errcode = '42501';
  end if;

  update public.pas_referral_qr_tokens
  set revoked_at = now()
  where referral_id = p_referral_id and revoked_at is null;
  get diagnostics v_count = row_count;

  insert into public.pas_referral_events(
    prescription_id, referral_id, event_type,
    actor_profile_id, actor_kind, metadata
  ) values (
    v_prescription.id, p_referral_id, 'qr.patient_revoked',
    v_actor, 'patient', jsonb_build_object('revoked_count', v_count)
  );

  return v_count;
end;
$function$;

revoke all on function private.pas_patient_revoke_referral_qr_token(uuid) from public, anon, authenticated;

-- Authenticated-only SECURITY DEFINER gateway. Only the patient who owns the parent RX may revoke.
create or replace function public.pas_patient_revoke_referral_qr_token(p_referral_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $function$
  select private.pas_patient_revoke_referral_qr_token(p_referral_id);
$function$;

revoke all on function public.pas_patient_revoke_referral_qr_token(uuid) from public, anon, authenticated;
grant execute on function public.pas_patient_revoke_referral_qr_token(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Consistent lifecycle lock order: parent prescription -> referral -> item.
-- Existing status triggers refresh the parent prescription after referral
-- transitions. These replacements remove the inverse referral -> parent order
-- that could deadlock against routing/QR issuance under concurrent requests.
-- ACLs are preserved by CREATE OR REPLACE; no direct table access is added.
-- ---------------------------------------------------------------------------
create or replace function private.pas_respond_to_referral(
  p_referral_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_prescription_id uuid;
  v_provider_id uuid;
  v_status text;
  v_next text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accept', 'reject', 'cancel') then
    raise exception 'Invalid referral response' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 2000 then
    raise exception 'Referral response note is too long' using errcode = '22023';
  end if;

  -- Read the parent identifier first, then acquire locks in the global order.
  select er.prescription_id into v_prescription_id
  from public.pas_execution_referrals er
  where er.id = p_referral_id;
  if not found then
    raise exception 'Referral not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.pas_insurance_prescriptions rx
  where rx.id = v_prescription_id
  for update;
  if not found then
    raise exception 'Referral prescription not found' using errcode = 'P0002';
  end if;

  select er.provider_id, er.status
  into v_provider_id, v_status
  from public.pas_execution_referrals er
  where er.id = p_referral_id
    and er.prescription_id = v_prescription_id
  for update;
  if not found or not private.pas_is_provider_operator(v_provider_id) then
    raise exception 'Provider operator permission required to respond to referral' using errcode = '42501';
  end if;
  if v_status <> 'assigned' then
    raise exception 'Only an assigned referral can be accepted, rejected or cancelled' using errcode = '23514';
  end if;

  v_next := case p_decision
    when 'accept' then 'accepted'
    when 'reject' then 'rejected'
    else 'cancelled'
  end;

  if p_decision in ('reject', 'cancel') then
    update public.pas_execution_referral_items
    set item_status = case when p_decision = 'reject' then 'rejected' else 'cancelled' end,
        response_note = p_note
    where referral_id = p_referral_id
      and item_status = 'assigned';
  end if;

  -- Item reconciliation may already have moved the referral to the same
  -- terminal state. The guarded update remains idempotent in that case.
  update public.pas_execution_referrals
  set status = v_next,
      response_note = p_note,
      accepted_at = case when p_decision = 'accept' then now() else accepted_at end,
      rejected_at = case when p_decision = 'reject' then now() else rejected_at end,
      cancelled_at = case when p_decision = 'cancel' then now() else cancelled_at end
  where id = p_referral_id
    and prescription_id = v_prescription_id
    and status = 'assigned';

  select er.status into v_next
  from public.pas_execution_referrals er
  where er.id = p_referral_id;

  return jsonb_build_object('referral_id', p_referral_id, 'status', v_next);
end;
$function$;

revoke all on function private.pas_respond_to_referral(uuid, text, text) from public, anon;
grant execute on function private.pas_respond_to_referral(uuid, text, text) to authenticated;

create or replace function private.pas_update_referral_item(
  p_referral_item_id uuid,
  p_next_status text,
  p_completed_quantity numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_prescription_id uuid;
  v_referral_id uuid;
  v_provider_id uuid;
  v_item public.pas_execution_referral_items%rowtype;
  v_next_status text;
  v_completed_quantity numeric;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_next_status is null or p_next_status not in (
    'accepted', 'in_progress', 'partially_completed', 'completed', 'rejected', 'cancelled'
  ) then
    raise exception 'Invalid referral item status' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 1000 then
    raise exception 'Referral item note is too long' using errcode = '22023';
  end if;

  -- Initial lookups are intentionally non-locking; acquire parent/referral/item
  -- locks only after the complete parent chain is known.
  select ri.referral_id, ri.prescription_id
  into v_referral_id, v_prescription_id
  from public.pas_execution_referral_items ri
  where ri.id = p_referral_item_id;
  if not found then
    raise exception 'Referral item not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.pas_insurance_prescriptions rx
  where rx.id = v_prescription_id
  for update;
  if not found then
    raise exception 'Referral prescription not found' using errcode = 'P0002';
  end if;

  select er.provider_id into v_provider_id
  from public.pas_execution_referrals er
  where er.id = v_referral_id
    and er.prescription_id = v_prescription_id
  for update;
  if not found or not private.pas_is_provider_operator(v_provider_id) then
    raise exception 'Provider operator permission required to update referral item' using errcode = '42501';
  end if;

  select ri.* into v_item
  from public.pas_execution_referral_items ri
  where ri.id = p_referral_item_id
    and ri.referral_id = v_referral_id
    and ri.prescription_id = v_prescription_id
  for update;
  if not found then
    raise exception 'Referral item not found' using errcode = 'P0002';
  end if;

  update public.pas_execution_referral_items
  set item_status = p_next_status,
      completed_quantity = coalesce(p_completed_quantity, completed_quantity),
      response_note = p_note
  where id = p_referral_item_id
  returning item_status, completed_quantity
  into v_next_status, v_completed_quantity;

  return jsonb_build_object(
    'referral_item_id', p_referral_item_id,
    'referral_id', v_referral_id,
    'item_status', v_next_status,
    'completed_quantity', v_completed_quantity
  );
end;
$function$;

revoke all on function private.pas_update_referral_item(uuid, text, numeric, text) from public, anon;
grant execute on function private.pas_update_referral_item(uuid, text, numeric, text) to authenticated;

-- Trigger-side reconciliation follows the same lock order as explicit actions.
create or replace function private.pas_reconcile_referral_from_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_referral_id uuid := coalesce(new.referral_id, old.referral_id);
  v_prescription_id uuid;
  v_status text;
  v_total bigint;
  v_terminal bigint;
  v_completed bigint;
  v_in_progress bigint;
  v_accepted bigint;
  v_target text;
begin
  select er.prescription_id into v_prescription_id
  from public.pas_execution_referrals er
  where er.id = v_referral_id;
  if not found then
    return coalesce(new, old);
  end if;

  perform 1
  from public.pas_insurance_prescriptions rx
  where rx.id = v_prescription_id
  for update;
  if not found then
    return coalesce(new, old);
  end if;

  select er.status into v_status
  from public.pas_execution_referrals er
  where er.id = v_referral_id
    and er.prescription_id = v_prescription_id
  for update;
  if not found or v_status in ('rejected', 'cancelled', 'completed', 'result_submitted', 'finalized') then
    return coalesce(new, old);
  end if;

  select count(*),
    count(*) filter (where ri.item_status in ('completed', 'rejected', 'cancelled')),
    count(*) filter (where ri.item_status = 'completed'),
    count(*) filter (where ri.item_status in ('in_progress', 'partially_completed')),
    count(*) filter (where ri.item_status = 'accepted')
  into v_total, v_terminal, v_completed, v_in_progress, v_accepted
  from public.pas_execution_referral_items ri
  where ri.referral_id = v_referral_id;

  if v_total = 0 then
    return coalesce(new, old);
  end if;

  if v_terminal = v_total then
    if v_completed > 0 then
      v_target := 'completed';
    elsif exists (
      select 1 from public.pas_execution_referral_items ri
      where ri.referral_id = v_referral_id and ri.item_status = 'cancelled'
    ) then
      v_target := 'cancelled';
    else
      v_target := 'rejected';
    end if;
  elsif v_completed > 0 or exists (
    select 1 from public.pas_execution_referral_items ri
    where ri.referral_id = v_referral_id and ri.item_status = 'partially_completed'
  ) then
    if v_status = 'in_progress' then v_target := 'partially_completed'; end if;
  elsif v_in_progress > 0 then
    if v_status = 'accepted' then v_target := 'in_progress'; end if;
  elsif v_accepted > 0 then
    if v_status = 'assigned' then v_target := 'accepted'; end if;
  end if;

  if v_target is not null and v_target is distinct from v_status then
    update public.pas_execution_referrals
    set status = v_target
    where id = v_referral_id and prescription_id = v_prescription_id;
  end if;

  return coalesce(new, old);
end;
$function$;

revoke all on function private.pas_reconcile_referral_from_items() from public, anon, authenticated;

create or replace function private.pas_reconcile_referral_from_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prescription_id uuid;
  v_referral public.pas_execution_referrals%rowtype;
  v_remaining bigint;
  v_final bigint;
begin
  select er.prescription_id into v_prescription_id
  from public.pas_execution_referrals er
  where er.id = new.referral_id;
  if not found then
    return new;
  end if;

  perform 1
  from public.pas_insurance_prescriptions rx
  where rx.id = v_prescription_id
  for update;
  if not found then
    return new;
  end if;

  select er.* into v_referral
  from public.pas_execution_referrals er
  where er.id = new.referral_id
    and er.prescription_id = v_prescription_id
  for update;
  if not found then
    return new;
  end if;

  if new.status = 'submitted' and v_referral.status = 'completed' then
    update public.pas_execution_referrals
    set status = 'result_submitted'
    where id = v_referral.id and prescription_id = v_prescription_id;
  elsif new.status in ('final', 'amended') and v_referral.status = 'result_submitted' then
    with latest as (
      select distinct on (rr.result_chain_id) rr.status
      from public.pas_referral_results rr
      where rr.referral_id = v_referral.id
      order by rr.result_chain_id, rr.version_number desc, rr.received_at desc
    )
    select count(*) filter (where l.status not in ('final', 'amended', 'retracted')),
           count(*) filter (where l.status in ('final', 'amended'))
    into v_remaining, v_final
    from latest l;

    if v_remaining = 0 and v_final > 0 then
      update public.pas_execution_referrals
      set status = 'finalized'
      where id = v_referral.id and prescription_id = v_prescription_id;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pas_reconcile_referral_from_results() from public, anon, authenticated;

-- Replace the provider QR issuer with an RX -> referral -> token lock order.
-- This serializes issuance with routing and expiry changes and avoids lock inversion.
create or replace function private.pas_issue_referral_qr_token(
  p_referral_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_prescription_id uuid;
  v_prescription public.pas_insurance_prescriptions%rowtype;
  v_referral public.pas_execution_referrals%rowtype;
  v_token_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid QR token hash' using errcode = '22023';
  end if;
  if p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '7 days' then
    raise exception 'Referral QR expiry must be within seven days' using errcode = '22023';
  end if;

  select er.prescription_id into v_prescription_id
  from public.pas_execution_referrals er
  where er.id = p_referral_id;
  if not found then
    raise exception 'Referral not found' using errcode = 'P0002';
  end if;

  select rx.* into v_prescription
  from public.pas_insurance_prescriptions rx
  where rx.id = v_prescription_id
  for update;
  if not found or v_prescription.patient_id is null
     or v_prescription.identity_match_status <> 'matched'
     or v_prescription.status in ('cancelled', 'rejected') then
    raise exception 'Referral parent prescription is not active and identity-verified' using errcode = '23514';
  end if;
  if v_prescription.expires_at is not null
     and v_prescription.expires_at <= clock_timestamp() then
    raise exception 'Insurance prescription has expired' using errcode = '23514';
  end if;

  select er.* into v_referral
  from public.pas_execution_referrals er
  where er.id = p_referral_id
    and er.prescription_id = v_prescription.id
  for update;
  if not found or v_referral.status in ('rejected', 'cancelled', 'finalized') then
    raise exception 'Referral is not active for QR issuance' using errcode = '23514';
  end if;
  if not private.pas_is_provider_operator(v_referral.provider_id) then
    raise exception 'Provider operator permission required to issue QR' using errcode = '42501';
  end if;

  update public.pas_referral_qr_tokens
  set revoked_at = now()
  where referral_id = p_referral_id and revoked_at is null and expires_at > now();

  insert into public.pas_referral_qr_tokens(referral_id, token_hash, issued_by, expires_at)
  values (p_referral_id, p_token_hash, v_actor, p_expires_at)
  returning id into v_token_id;

  insert into public.pas_referral_events(
    prescription_id, referral_id, event_type, actor_profile_id, actor_kind, metadata
  ) values (
    v_prescription.id, p_referral_id, 'qr.issued', v_actor, 'provider',
    jsonb_build_object('token_id', v_token_id, 'expires_at', p_expires_at)
  );

  return v_token_id;
end;
$function$;

revoke all on function private.pas_issue_referral_qr_token(uuid, text, timestamptz) from public, anon;
grant execute on function private.pas_issue_referral_qr_token(uuid, text, timestamptz) to authenticated;

-- Resolve QR in the same RX -> referral -> token order. The first token lookup is
-- non-locking; revocation/expiry is re-validated after the parent and referral locks.
create or replace function private.pas_resolve_referral_qr_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_token public.pas_referral_qr_tokens%rowtype;
  v_referral public.pas_execution_referrals%rowtype;
  v_prescription public.pas_insurance_prescriptions%rowtype;
  v_provider public.pas_provider_registry%rowtype;
  v_access_count integer;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid referral QR token' using errcode = '22023';
  end if;

  select qt.* into v_token
  from public.pas_referral_qr_tokens qt
  where qt.token_hash = p_token_hash
    and qt.revoked_at is null
    and qt.expires_at > now();
  if not found then
    raise exception 'Referral QR is invalid, expired or revoked' using errcode = '42501';
  end if;

  select er.* into v_referral
  from public.pas_execution_referrals er
  where er.id = v_token.referral_id;
  if not found then
    raise exception 'Referral is not available' using errcode = '42501';
  end if;

  select rx.* into v_prescription
  from public.pas_insurance_prescriptions rx
  where rx.id = v_referral.prescription_id
  for update;
  if not found
     or v_prescription.patient_id is null
     or v_prescription.identity_match_status <> 'matched'
     or v_prescription.status in ('cancelled', 'rejected')
     or (v_prescription.expires_at is not null and v_prescription.expires_at <= clock_timestamp()) then
    raise exception 'Insurer prescription is expired, cancelled or identity-unverified' using errcode = '42501';
  end if;

  select er.* into v_referral
  from public.pas_execution_referrals er
  where er.id = v_referral.id
    and er.prescription_id = v_prescription.id
  for update;
  if not found or v_referral.status in ('rejected', 'cancelled', 'finalized') then
    raise exception 'Referral is not available' using errcode = '42501';
  end if;
  if not private.pas_is_provider_member(v_referral.provider_id) then
    raise exception 'QR does not grant access outside its assigned provider' using errcode = '42501';
  end if;

  select qt.* into v_token
  from public.pas_referral_qr_tokens qt
  where qt.id = v_token.id
    and qt.token_hash = p_token_hash
    and qt.referral_id = v_referral.id
    and qt.revoked_at is null
    and qt.expires_at > now()
  for update;
  if not found then
    raise exception 'Referral QR is invalid, expired or revoked' using errcode = '42501';
  end if;

  select pr.* into v_provider
  from public.pas_provider_registry pr
  where pr.id = v_referral.provider_id and pr.status = 'active';
  if not found then
    raise exception 'Assigned provider is inactive' using errcode = '42501';
  end if;

  update public.pas_referral_qr_tokens
  set access_count = access_count + 1, last_accessed_at = now()
  where id = v_token.id
  returning access_count into v_access_count;

  insert into public.pas_referral_events(
    prescription_id, referral_id, event_type, actor_profile_id, actor_kind, metadata
  ) values (
    v_referral.prescription_id, v_referral.id, 'qr.scanned', v_actor, 'provider',
    jsonb_build_object('token_id', v_token.id, 'access_count', v_access_count)
  );

  select jsonb_build_object(
    'referral', jsonb_build_object(
      'id', v_referral.id,
      'status', v_referral.status,
      'provider_admission_reference', v_referral.provider_admission_reference,
      'provider_admission_at', v_referral.provider_admission_at,
      'assigned_at', v_referral.assigned_at
    ),
    'provider', jsonb_build_object(
      'id', v_provider.id,
      'display_name', v_provider.display_name,
      'provider_kind', v_provider.provider_kind
    ),
    'patient', jsonb_build_object(
      'display_name', p.full_name,
      'date_of_birth', pp.date_of_birth,
      'sex', pp.sex
    ),
    'payer', jsonb_build_object(
      'payer_key', v_prescription.payer_key,
      'external_tracking_number', v_prescription.external_tracking_number,
      'external_prescription_id', v_prescription.external_prescription_id
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'referral_item_id', ri.id,
        'prescription_item_id', pi.id,
        'line_number', pi.line_number,
        'item_kind', pi.item_kind,
        'display', pi.external_display,
        'external_code', pi.external_code,
        'quantity', pi.quantity,
        'unit', pi.unit_label,
        'status', ri.item_status
      ) order by pi.line_number, pi.id)
      from public.pas_execution_referral_items ri
      join public.pas_insurance_prescription_items pi
        on pi.id = ri.prescription_item_id and pi.prescription_id = ri.prescription_id
      where ri.referral_id = v_referral.id and pi.item_status = 'active'
    ), '[]'::jsonb)
  ) into v_result
  from public.profiles p
  join public.patient_profiles pp on pp.id = p.id
  where p.id = v_prescription.patient_id;

  if v_result is null then
    raise exception 'Linked patient profile is unavailable' using errcode = '23503';
  end if;
  return v_result;
end;
$function$;

revoke all on function private.pas_resolve_referral_qr_token(text) from public, anon;
grant execute on function private.pas_resolve_referral_qr_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Expiry invariant: routing is refused at the database boundary, even if an
-- admin/server action is replayed or races the expiry timestamp.
-- The parent RX row is locked so concurrent expiry changes cannot pass between
-- validation and the insertion of its referral.
-- ---------------------------------------------------------------------------
create or replace function private.pas_guard_execution_referral_not_expired()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prescription public.pas_insurance_prescriptions%rowtype;
begin
  select rx.* into v_prescription
  from public.pas_insurance_prescriptions rx
  where rx.id = new.prescription_id
  for update;

  if not found
     or v_prescription.patient_id is null
     or v_prescription.identity_match_status <> 'matched'
     or v_prescription.status not in ('ready_for_routing', 'partially_routed') then
    raise exception 'Prescription is not eligible for execution referral routing' using errcode = '23514';
  end if;

  if v_prescription.expires_at is not null
     and v_prescription.expires_at <= clock_timestamp() then
    raise exception 'Insurance prescription has expired; no new referral can be routed' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.pas_guard_execution_referral_not_expired() from public, anon, authenticated;
drop trigger if exists trg_pas_guard_execution_referral_not_expired on public.pas_execution_referrals;
create trigger trg_pas_guard_execution_referral_not_expired
before insert on public.pas_execution_referrals
for each row execute function private.pas_guard_execution_referral_not_expired();

-- Additional item-insert guard: routing may reuse an existing referral (ON CONFLICT),
-- so the parent-referral INSERT trigger alone is not sufficient to protect later item adds.
create or replace function private.pas_guard_execution_referral_item_not_expired()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prescription public.pas_insurance_prescriptions%rowtype;
begin
  select rx.* into v_prescription
  from public.pas_insurance_prescriptions rx
  where rx.id = new.prescription_id
  for update;

  if not found
     or v_prescription.patient_id is null
     or v_prescription.identity_match_status <> 'matched'
     or v_prescription.status not in ('ready_for_routing', 'partially_routed') then
    raise exception 'Prescription is not eligible for additional referral items' using errcode = '23514';
  end if;
  if v_prescription.expires_at is not null
     and v_prescription.expires_at <= clock_timestamp() then
    raise exception 'Insurance prescription has expired; no new referral items can be routed' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.pas_guard_execution_referral_item_not_expired() from public, anon, authenticated;
drop trigger if exists trg_pas_guard_execution_referral_item_not_expired on public.pas_execution_referral_items;
create trigger trg_pas_guard_execution_referral_item_not_expired
before insert on public.pas_execution_referral_items
for each row execute function private.pas_guard_execution_referral_item_not_expired();

-- QR insertion and QR consumption both re-check the parent prescription expiry.
create or replace function private.pas_guard_referral_qr_parent_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prescription public.pas_insurance_prescriptions%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.expires_at is null
       or new.expires_at <= clock_timestamp()
       or new.expires_at > clock_timestamp() + interval '7 days' then
      raise exception 'Referral QR expiry must be in the next seven days' using errcode = '22023';
    end if;

    select rx.* into v_prescription
    from public.pas_execution_referrals er
    join public.pas_insurance_prescriptions rx on rx.id = er.prescription_id
    where er.id = new.referral_id
    for update of rx;

    if not found
       or v_prescription.patient_id is null
       or v_prescription.identity_match_status <> 'matched'
       or v_prescription.status in ('cancelled', 'rejected') then
      raise exception 'QR requires a verified insurer prescription identity' using errcode = '23514';
    end if;

    if v_prescription.expires_at is not null
       and v_prescription.expires_at <= clock_timestamp() then
      raise exception 'Expired insurer prescription cannot issue a referral QR' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' and new.access_count > old.access_count then
    select rx.* into v_prescription
    from public.pas_execution_referrals er
    join public.pas_insurance_prescriptions rx on rx.id = er.prescription_id
    where er.id = new.referral_id;

    if not found
       or v_prescription.patient_id is null
       or v_prescription.identity_match_status <> 'matched'
       or v_prescription.status in ('cancelled', 'rejected')
       or (v_prescription.expires_at is not null and v_prescription.expires_at <= clock_timestamp()) then
      raise exception 'Expired or unverified insurer prescription cannot resolve a referral QR' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pas_guard_referral_qr_parent_expiry() from public, anon, authenticated;
drop trigger if exists trg_pas_guard_referral_qr_insert_expiry on public.pas_referral_qr_tokens;
create trigger trg_pas_guard_referral_qr_insert_expiry
before insert on public.pas_referral_qr_tokens
for each row execute function private.pas_guard_referral_qr_parent_expiry();

drop trigger if exists trg_pas_guard_referral_qr_resolve_expiry on public.pas_referral_qr_tokens;
create trigger trg_pas_guard_referral_qr_resolve_expiry
before update of access_count on public.pas_referral_qr_tokens
for each row execute function private.pas_guard_referral_qr_parent_expiry();

-- ---------------------------------------------------------------------------
-- Membership invariant: a patient account can never hold an active provider
-- membership, even if an admin action is bypassed or called through another
-- privileged server path. Revocation/inactivation remains possible for legacy
-- rows so they can be cleaned up safely.
-- ---------------------------------------------------------------------------
create or replace function private.pas_guard_provider_membership_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  if new.status = 'active' then
    select p.role::text into v_role
    from public.profiles p
    where p.id = new.profile_id
    for update;

    if not found or v_role = 'patient' then
      raise exception 'Patient accounts cannot be active provider members' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.pas_guard_provider_membership_profile() from public, anon, authenticated;
drop trigger if exists trg_pas_guard_provider_membership_profile on public.pas_provider_memberships;
create trigger trg_pas_guard_provider_membership_profile
before insert or update of profile_id, status on public.pas_provider_memberships
for each row execute function private.pas_guard_provider_membership_profile();

-- Prevent changing an existing active member profile into a patient role.
create or replace function private.pas_guard_profile_role_provider_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.role::text = 'patient'
     and old.role is distinct from new.role
     and exists (
       select 1 from public.pas_provider_memberships m
       where m.profile_id = new.id and m.status = 'active'
     ) then
    raise exception 'Revoke active provider memberships before changing a profile to patient role' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function private.pas_guard_profile_role_provider_membership() from public, anon, authenticated;
drop trigger if exists trg_pas_guard_profile_role_provider_membership on public.profiles;
create trigger trg_pas_guard_profile_role_provider_membership
before update of role on public.profiles
for each row execute function private.pas_guard_profile_role_provider_membership();

commit;
