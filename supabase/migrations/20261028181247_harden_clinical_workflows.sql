CREATE OR REPLACE FUNCTION public.guard_diagnostic_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_order_branch_id uuid;
  v_order_laboratory_id uuid;
begin
  if public.is_service_role() then
    return new;
  end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  select lo.laboratory_branch_id, lo.laboratory_id
    into v_order_branch_id, v_order_laboratory_id
  from public.lab_orders lo
  where lo.id = new.lab_order_id;

  if not found then
    raise exception 'Diagnostic report lab order not found';
  end if;

  if not (
    v_order_laboratory_id = v_uid
    or (v_order_branch_id is not null and public.is_laboratory_branch_member(v_order_branch_id, v_uid))
  ) then
    raise exception 'Laboratory account is not authorized for this order';
  end if;

  if tg_op = 'INSERT' then
    if new.laboratory_id is distinct from v_uid
       or new.entered_by is distinct from v_uid then
      raise exception 'Report must be created and entered by the current laboratory user';
    end if;

    if new.status <> 'draft' then
      raise exception 'New diagnostic reports must start as draft';
    end if;

    if new.finalized_by is not null or new.finalized_at is not null then
      raise exception 'Draft report cannot have finalized fields';
    end if;

    return new;
  end if;

  if new.id is distinct from old.id
     or new.lab_order_id is distinct from old.lab_order_id
     or new.laboratory_id is distinct from old.laboratory_id
     or new.entered_by is distinct from old.entered_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Immutable diagnostic report fields cannot change';
  end if;

  if old.status in ('final','amended')
     and (
       new.finalized_by is distinct from old.finalized_by
       or new.finalized_at is distinct from old.finalized_at
     ) then
    raise exception 'finalized_by/finalized_at cannot change on finalized reports';
  end if;

  -- A draft must never enter the patient-visible amended state directly.
  if new.status is distinct from old.status
     and not ((old.status = 'draft' and new.status = 'final')
              or (old.status = 'final' and new.status = 'amended')) then
    raise exception 'Invalid diagnostic report status transition: % -> %', old.status, new.status;
  end if;

  if new.status = 'draft'
     and (new.finalized_by is not null or new.finalized_at is not null) then
    raise exception 'Draft reports cannot contain finalization provenance';
  end if;

  if new.status = 'final' and old.status <> 'final' then
    if old.status <> 'draft' then
      raise exception 'Only a draft report can be finalized';
    end if;
    if new.finalized_by is distinct from v_uid or new.finalized_at is null then
      raise exception 'Finalized report must record the current user and finalized_at';
    end if;

    if exists (
      select 1
      from (
        select loi.test_definition_id as test_id
        from public.lab_order_items loi
        where loi.lab_order_id = new.lab_order_id
          and loi.test_definition_id is not null
        union
        select tpi.test_definition_id
        from public.lab_order_items loi
        join public.test_panel_items tpi on tpi.panel_id=loi.test_panel_id
        where loi.lab_order_id=new.lab_order_id and tpi.is_required=true
      ) required_tests
      where not exists (
        select 1 from public.observations o
        where o.diagnostic_report_id=new.id
          and o.test_definition_id=required_tests.test_id
          and o.status in ('preliminary','final','corrected')
      )
    ) then
      raise exception 'All required tests must have a valid observation before finalizing the report';
    end if;
  elsif old.status='final' and new.status='amended' then
    null;
  elsif old.status='amended' and new.status <> 'amended' then
    raise exception 'Amended report cannot return to another status';
  elsif new.status is distinct from old.status and old.status <> 'draft' then
    raise exception 'Invalid diagnostic report status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_prescription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.is_service_role() THEN RETURN NEW; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id=v_uid AND dp.is_verified=true) THEN
    RAISE EXCEPTION 'Doctor must be verified';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.doctor_id <> v_uid THEN
      RAISE EXCEPTION 'Prescription doctor must equal current user';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships pdr
      WHERE pdr.patient_id = NEW.patient_id
        AND pdr.doctor_id = v_uid
        AND pdr.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Doctor has no active relationship with patient';
    END IF;

    IF NEW.diagnostic_report_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.diagnostic_reports dr
         JOIN public.lab_orders lo ON lo.id=dr.lab_order_id
         WHERE dr.id=NEW.diagnostic_report_id
           AND lo.patient_id=NEW.patient_id
           AND lo.doctor_id=v_uid
       ) THEN
      RAISE EXCEPTION 'Prescription report does not belong to this patient/doctor';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.diagnostic_report_id IS DISTINCT FROM OLD.diagnostic_report_id
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Prescription identity cannot change';
    END IF;
    IF NEW.doctor_id <> v_uid THEN
      RAISE EXCEPTION 'Only prescription owner can update it';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.correct_lab_observation(p_report_id uuid, p_observation_id uuid, p_value_numeric numeric DEFAULT NULL::numeric, p_value_text text DEFAULT NULL::text, p_value_boolean boolean DEFAULT NULL::boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_report_status text;
  v_test_definition_id uuid;
  v_value_type text;
  v_allows_negative boolean;
  v_unit text;
  v_reference_range_template_id uuid;
  v_reference_min numeric;
  v_reference_max numeric;
  v_reference_text text;
  v_reference_source text;
  v_flag public.flag_status;
  v_new_id uuid;
  v_branch_id uuid;
  v_order_laboratory_id uuid;
  v_value_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select dr.status::text, o.test_definition_id, td.value_type, td.allows_negative,
         o.unit, o.reference_range_template_id, o.reference_min, o.reference_max,
         o.reference_text, o.reference_source, o.flag,
         lo.laboratory_branch_id, lo.laboratory_id
    into v_report_status, v_test_definition_id, v_value_type, v_allows_negative,
         v_unit, v_reference_range_template_id, v_reference_min, v_reference_max,
         v_reference_text, v_reference_source, v_flag,
         v_branch_id, v_order_laboratory_id
  from public.diagnostic_reports dr
  join public.observations o on o.diagnostic_report_id = dr.id
  join public.test_definitions td on td.id = o.test_definition_id
  join public.lab_orders lo on lo.id = dr.lab_order_id
  where dr.id = p_report_id
    and o.id = p_observation_id
    and o.status in ('final', 'corrected')
    and (
      lo.laboratory_id = v_uid
      or (lo.laboratory_branch_id is not null and public.is_laboratory_branch_result_member(lo.laboratory_branch_id, v_uid))
    )
  for update of dr, o;

  if not found then raise exception 'Correctable observation not found'; end if;
  if v_report_status not in ('final', 'amended') then
    raise exception 'Only finalized reports can be corrected';
  end if;

  v_value_count := CASE WHEN p_value_numeric IS NOT NULL THEN 1 ELSE 0 END
                 + CASE WHEN nullif(btrim(p_value_text), '') IS NOT NULL THEN 1 ELSE 0 END
                 + CASE WHEN p_value_boolean IS NOT NULL THEN 1 ELSE 0 END;
  if v_value_count <> 1 then
    raise exception 'Exactly one typed result value is required';
  end if;

  if v_value_type = 'numeric' then
    if p_value_numeric is null or p_value_text is not null or p_value_boolean is not null then
      raise exception 'Numeric test requires only value_numeric';
    end if;
    if p_value_numeric::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Numeric result must be finite';
    end if;
    if p_value_numeric < 0 and not v_allows_negative then
      raise exception 'Negative value is not allowed for this test';
    end if;

    if v_reference_min is null and v_reference_max is null then
      v_flag := 'unknown'::public.flag_status;
    elsif (v_reference_min is not null and v_reference_min::text in ('NaN', 'Infinity', '-Infinity'))
       or (v_reference_max is not null and v_reference_max::text in ('NaN', 'Infinity', '-Infinity')) then
      v_flag := 'unknown'::public.flag_status;
    elsif v_reference_min is not null and v_reference_max is not null
          and v_reference_min > v_reference_max then
      v_flag := 'unknown'::public.flag_status;
    elsif v_reference_min is not null and p_value_numeric < v_reference_min then
      v_flag := 'low'::public.flag_status;
    elsif v_reference_max is not null and p_value_numeric > v_reference_max then
      v_flag := 'high'::public.flag_status;
    else
      v_flag := 'normal'::public.flag_status;
    end if;
  elsif v_value_type = 'text' then
    if nullif(btrim(p_value_text), '') is null or p_value_numeric is not null or p_value_boolean is not null then
      raise exception 'Text test requires only value_text';
    end if;
    v_flag := 'unknown'::public.flag_status;
  elsif v_value_type = 'boolean' then
    if p_value_boolean is null or p_value_numeric is not null or p_value_text is not null then
      raise exception 'Boolean test requires only value_boolean';
    end if;
    v_flag := 'unknown'::public.flag_status;
  else
    raise exception 'Unsupported test value type';
  end if;

  update public.observations
  set status = 'superseded'
  where id = p_observation_id;

  insert into public.observations (
    diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean,
    unit, reference_range_template_id, reference_min, reference_max, reference_text,
    reference_source, flag, status, supersedes_observation_id, entered_by
  ) values (
    p_report_id, v_test_definition_id, p_value_numeric,
    nullif(btrim(p_value_text), ''), p_value_boolean,
    v_unit, v_reference_range_template_id, v_reference_min, v_reference_max, v_reference_text,
    v_reference_source, v_flag, 'corrected', p_observation_id, v_uid
  ) returning id into v_new_id;

  if v_report_status = 'final' then
    update public.diagnostic_reports set status = 'amended' where id = p_report_id;
  end if;

  return v_new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_lab_report(p_report_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_branch_id uuid;
  v_order_owner uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select dr.lab_order_id, lo.laboratory_branch_id, lo.laboratory_id
    into v_order_id, v_branch_id, v_order_owner
  from public.diagnostic_reports dr
  join public.lab_orders lo on lo.id=dr.lab_order_id
  where dr.id=p_report_id
    and dr.status='draft'
    and (
      dr.laboratory_id=v_uid
      or lo.laboratory_id=v_uid
      or (lo.laboratory_branch_id is not null and public.is_laboratory_branch_result_member(lo.laboratory_branch_id,v_uid))
    )
  for update of dr;

  if v_order_id is null then raise exception 'Draft diagnostic report not found'; end if;

  if not (
    v_order_owner=v_uid
    or (v_branch_id is not null and public.is_laboratory_branch_result_member(v_branch_id,v_uid))
  ) then
    raise exception 'Only authorized staff of the destination branch can finalize';
  end if;

  if not exists (
    select 1 from public.lab_orders lo
    where lo.id=v_order_id
      and lo.status='in_progress'
      and (
        lo.laboratory_id=v_uid
        or (lo.laboratory_branch_id is not null and public.is_laboratory_branch_result_member(lo.laboratory_branch_id,v_uid))
      )
  ) then
    raise exception 'Order must be in_progress before finalization';
  end if;

  if exists (
    select 1
    from (
      select loi.test_definition_id as test_id
      from public.lab_order_items loi
      where loi.lab_order_id=v_order_id and loi.test_definition_id is not null
      union
      select tpi.test_definition_id
      from public.lab_order_items loi
      join public.test_panel_items tpi on tpi.panel_id=loi.test_panel_id
      where loi.lab_order_id=v_order_id and tpi.is_required=true
    ) required_tests
    where not exists (
      select 1 from public.observations o
      where o.diagnostic_report_id=p_report_id
        and o.test_definition_id=required_tests.test_id
        and o.status='preliminary'
    )
  ) then
    raise exception 'All required tests must have preliminary results before finalization';
  end if;

  update public.diagnostic_reports
  set status='final', finalized_by=v_uid, finalized_at=now()
  where id=p_report_id;

  update public.observations
  set status='final'
  where diagnostic_report_id=p_report_id and status='preliminary';

  update public.lab_orders
  set status='completed', completed_at=now()
  where id=v_order_id;

  return p_report_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_laboratory_branch_member(p_branch_id uuid, p_profile_id uuid, p_role_in_branch text DEFAULT 'member'::text, p_is_active boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_branch public.laboratory_branches%rowtype;
  v_member_id uuid;
  v_user_role text;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id=v_uid and p.role='admin'
  ) then raise exception 'Administrator access required'; end if;

  select * into v_branch from public.laboratory_branches b
  where b.id=p_branch_id;
  if not found then raise exception 'Laboratory branch not found'; end if;

  if coalesce(p_is_active,true) then
    if not v_branch.is_active then raise exception 'Cannot activate a member on an inactive branch'; end if;
    select p.role::text into v_user_role from public.profiles p where p.id=p_profile_id;
    if not found or v_user_role <> 'laboratory' then
      raise exception 'Branch members must be laboratory accounts';
    end if;
    if not exists (
      select 1 from public.laboratory_profiles lp
      where lp.id=p_profile_id and lp.organization_id=v_branch.organization_id
    ) then
      raise exception 'Laboratory account must belong to the branch organization';
    end if;
  elsif not exists (
    select 1 from public.laboratory_branch_members lbm
    where lbm.branch_id=p_branch_id and lbm.profile_id=p_profile_id
  ) then
    raise exception 'Existing branch membership not found to deactivate';
  end if;

  if coalesce(btrim(p_role_in_branch),'') not in ('manager','reception','laboratory_staff','member','collector') then
    raise exception 'Invalid laboratory branch role';
  end if;

  insert into public.laboratory_branch_members(
    branch_id,profile_id,role_in_branch,is_active,granted_by
  ) values (
    p_branch_id,p_profile_id,btrim(p_role_in_branch),coalesce(p_is_active,true),v_uid
  )
  on conflict (branch_id,profile_id) do update
  set role_in_branch=excluded.role_in_branch,
      is_active=excluded.is_active,
      granted_by=excluded.granted_by
  returning id into v_member_id;

  insert into public.lab_workflow_events(
    actor_id,event_type,entity_type,entity_id,laboratory_branch_id,metadata
  ) values (
    v_uid,case when coalesce(p_is_active,true) then 'branch.member_granted' else 'branch.member_deactivated' end,
    'laboratory_branch_member',v_member_id,p_branch_id,
    jsonb_build_object('role_in_branch',btrim(p_role_in_branch),'is_active',coalesce(p_is_active,true))
  );

  return v_member_id;
end;
$function$;


-- Check the committed state, after the finalization RPC has updated the report,
-- observations and order. A direct Data API UPDATE cannot publish partial data.
create or replace function private.assert_published_report_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_report public.diagnostic_reports%rowtype;
  v_order public.lab_orders%rowtype;
begin
  select * into v_report from public.diagnostic_reports where id = new.id;
  if not found or v_report.status not in ('final','amended') then return null; end if;

  select * into v_order from public.lab_orders where id = v_report.lab_order_id;
  if not found or v_order.status <> 'completed' then
    raise exception 'A published report requires a completed laboratory order';
  end if;
  if v_report.finalized_by is null or v_report.finalized_at is null then
    raise exception 'A published report requires finalization provenance';
  end if;
  if exists (select 1 from public.observations o
             where o.diagnostic_report_id = v_report.id and o.status = 'preliminary') then
    raise exception 'A published report cannot contain preliminary results';
  end if;

  if not exists (select 1 from public.lab_order_items i where i.lab_order_id = v_order.id) then
    raise exception 'A published report requires ordered tests';
  end if;
  if exists (
    select 1 from (
      select i.test_definition_id as test_id
      from public.lab_order_items i
      where i.lab_order_id = v_order.id and i.test_definition_id is not null
      union
      select pi.test_definition_id
      from public.lab_order_items i
      join public.test_panel_items pi on pi.panel_id = i.test_panel_id
      where i.lab_order_id = v_order.id and pi.is_required = true
    ) required_tests
    where not exists (
      select 1 from public.observations o
      where o.diagnostic_report_id = v_report.id
        and o.test_definition_id = required_tests.test_id
        and o.status in ('final','corrected')
    )
  ) then
    raise exception 'Every required test must have a current final result';
  end if;
  return null;
end;
$function$;

revoke all on function private.assert_published_report_integrity() from public, anon, authenticated;

drop trigger if exists published_report_integrity on public.diagnostic_reports;
create constraint trigger published_report_integrity
after insert or update of status on public.diagnostic_reports
deferrable initially deferred
for each row
when (new.status in ('final','amended'))
execute function private.assert_published_report_integrity();

-- A finalized result may only be superseded when its replacement exists in the
-- same committed transaction. This preserves the existing atomic correction RPC.
create or replace function private.assert_final_result_replacement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_predecessor_id uuid;
  v_predecessor public.observations%rowtype;
begin
  if tg_op = 'DELETE' then
    v_predecessor_id := old.supersedes_observation_id;
  else
    v_predecessor_id := old.id;
  end if;
  select * into v_predecessor from public.observations where id = v_predecessor_id;
  if not found then return null; end if;
  if not exists (select 1 from public.diagnostic_reports where id = v_predecessor.diagnostic_report_id) then
    return null;
  end if;
  if v_predecessor.status = 'superseded' and not exists (
    select 1 from public.observations replacement
    where replacement.supersedes_observation_id = v_predecessor.id
      and replacement.diagnostic_report_id = v_predecessor.diagnostic_report_id
      and replacement.test_definition_id = v_predecessor.test_definition_id
      and replacement.status in ('corrected','superseded')
  ) then
    raise exception 'A finalized result can only be superseded atomically with its correction';
  end if;
  return null;
end;
$function$;

revoke all on function private.assert_final_result_replacement() from public, anon, authenticated;

drop trigger if exists finalized_result_replacement on public.observations;
create constraint trigger finalized_result_replacement
after update of status on public.observations
deferrable initially deferred
for each row
when (old.status in ('final','corrected') and new.status = 'superseded')
execute function private.assert_final_result_replacement();

drop trigger if exists finalized_result_replacement_delete on public.observations;
create constraint trigger finalized_result_replacement_delete
after delete on public.observations
deferrable initially deferred
for each row
when (old.supersedes_observation_id is not null)
execute function private.assert_final_result_replacement();

create unique index if not exists observations_single_correction_successor
on public.observations (supersedes_observation_id)
where supersedes_observation_id is not null;

-- Keep the pre-existing collector role and support the roles already offered by
-- the application. Collectors and reception remain excluded from result writes.
alter table public.laboratory_branch_members
drop constraint if exists laboratory_branch_members_role_in_branch_check;
alter table public.laboratory_branch_members
add constraint laboratory_branch_members_role_in_branch_check
check (role_in_branch in ('manager','reception','laboratory_staff','member','collector'));

-- These privileges are unnecessary for the Data API and bypass row filtering.
do $block$
declare v_table record;
begin
  for v_table in
    select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
  loop
    execute format('revoke truncate, references, trigger, maintain on table %I.%I from anon, authenticated', v_table.nspname, v_table.relname);
  end loop;
end;
$block$;
