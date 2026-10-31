-- Center identity is assigned by platform administration, never by the center.
create table public.pas_medical_centers (
 profile_id uuid primary key references public.laboratory_profiles(id) on delete cascade,
 center_type text not null check(center_type in ('laboratory','radiology','mri','ct','ultrasound','mammography','ecg','physiotherapy','other')),
 display_name text not null check(length(btrim(display_name)) between 2 and 160),
 is_active boolean not null default true,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index pas_centers_type_active_idx on public.pas_medical_centers(center_type,is_active);
alter table public.pas_medical_centers enable row level security;
revoke all on public.pas_medical_centers from public,anon,authenticated;
grant select on public.pas_medical_centers to authenticated;
grant all on public.pas_medical_centers to service_role;
create function private.pas_center_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.admin_profiles a on a.id=p.id where p.id=auth.uid() and p.role='admin')
$$;
revoke all on function private.pas_center_is_admin() from public,anon;
grant execute on function private.pas_center_is_admin() to authenticated,service_role;
create policy pas_center_read on public.pas_medical_centers for select to authenticated
 using(profile_id=(select auth.uid()) or private.pas_center_is_admin());

insert into public.pas_medical_centers(profile_id,center_type,display_name)
 select l.id,'laboratory',coalesce(nullif(btrim(o.name),''),nullif(btrim(p.full_name),''),'آزمایشگاه')
 from public.laboratory_profiles l join public.profiles p on p.id=l.id
 left join public.organizations o on o.id=l.organization_id;

create function private.pas_center_service(p_type text) returns text language sql immutable set search_path='' as $$
 select case p_type when 'radiology' then 'xray' when 'mri' then 'mri' when 'ct' then 'ct'
 when 'ultrasound' then 'ultrasound' when 'mammography' then 'mammography' when 'ecg' then 'ecg'
 when 'physiotherapy' then 'physiotherapy' when 'other' then 'other' else null end
$$;
create function private.pas_center_accepts(p_id uuid,p_service text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pas_medical_centers c join public.profiles p on p.id=c.profile_id
 where c.profile_id=p_id and c.is_active and p.role='laboratory' and private.pas_center_service(c.center_type)=p_service)
$$;
create function private.pas_is_lab(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pas_medical_centers c join public.profiles p on p.id=c.profile_id
 where c.profile_id=p_id and c.is_active and c.center_type='laboratory' and p.role='laboratory')
$$;
revoke all on function private.pas_center_service(text),private.pas_center_accepts(uuid,text),private.pas_is_lab(uuid) from public,anon;
grant execute on function private.pas_center_service(text),private.pas_center_accepts(uuid,text),private.pas_is_lab(uuid) to authenticated,service_role;

create function private.pas_guard_center() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.is_service_role() and not (private.pas_role()='admin' and exists(select 1 from public.admin_profiles where id=auth.uid())) then
  raise exception 'Center identity is administrator controlled' using errcode='42501';
 end if;
 if tg_op='UPDATE' and (new.profile_id is distinct from old.profile_id or new.center_type is distinct from old.center_type or new.created_by is distinct from old.created_by) then
  raise exception 'Center type is immutable; provision a separate licensed account' using errcode='23514';
 end if;
 if tg_op='UPDATE' then new.updated_at:=now(); end if;
 return new;
end $$;
create trigger pas_guard_center before insert or update on public.pas_medical_centers for each row execute function private.pas_guard_center();

-- Old administrative laboratory provisioning continues to create a lab identity.
create function private.pas_seed_lab_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.is_service_role() and not (private.pas_role()='admin' and exists(select 1 from public.admin_profiles where id=auth.uid())) then
  raise exception 'Only administration can provision medical center accounts' using errcode='42501';
 end if;
 insert into public.pas_medical_centers(profile_id,center_type,display_name)
 select new.id,'laboratory',coalesce(nullif(btrim(o.name),''),'آزمایشگاه') from public.organizations o where o.id=new.organization_id
 on conflict do nothing;
 return new;
end $$;
create trigger pas_seed_lab_identity after insert on public.laboratory_profiles for each row execute function private.pas_seed_lab_identity();

create function private.pas_provision_center(p_profile uuid,p_actor uuid,p_type text,p_name text,p_license text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare org_id uuid;
begin
 if not public.is_service_role() or not exists(select 1 from public.profiles p join public.admin_profiles a on a.id=p.id where p.id=p_actor and p.role='admin') then
  raise exception 'Administrator provisioning required' using errcode='42501';
 end if;
 if p_type not in ('laboratory','radiology','mri','ct','ultrasound','mammography','ecg','physiotherapy','other') or length(btrim(p_name)) not between 2 and 160 or length(btrim(p_license)) not between 1 and 100 then
  raise exception 'Invalid center identity' using errcode='23514';
 end if;
 if exists(select 1 from public.laboratory_profiles where id=p_profile) then raise exception 'Center account already provisioned' using errcode='23505'; end if;
 if exists(select 1 from public.patient_profiles where id=p_profile) or exists(select 1 from public.doctor_profiles where id=p_profile) or exists(select 1 from public.admin_profiles where id=p_profile) then raise exception 'Existing clinical identity cannot become a center' using errcode='23514'; end if;
 update public.profiles set role='laboratory' where id=p_profile;
 if not found then raise exception 'Account not found' using errcode='23503'; end if;
 insert into public.organizations(name,type,license_number) values(btrim(p_name),case when p_type='laboratory' then 'laboratory' else 'clinic' end,btrim(p_license)) returning id into org_id;
 -- Replace only this newly provisioned seed within the same transaction.
 -- Existing accounts can never be reclassified by this function.
 insert into public.laboratory_profiles(id,organization_id,license_number) values(p_profile,org_id,btrim(p_license));
 delete from public.pas_medical_centers where profile_id=p_profile;
 insert into public.pas_medical_centers(profile_id,center_type,display_name,created_by) values(p_profile,p_type,btrim(p_name),p_actor);
 if private.pas_center_service(p_type) is not null then
  insert into public.pas_provider_services(provider_id,service_kind) values(p_profile,private.pas_center_service(p_type));
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'center.provision','pas_medical_centers',p_profile,jsonb_build_object('center_type',p_type,'organization_id',org_id));
 return jsonb_build_object('id',p_profile,'organization_id',org_id);
end $$;
create function public.pas_provision_center(p_profile uuid,p_actor uuid,p_type text,p_name text,p_license text)
 returns jsonb language sql security invoker set search_path='' as $$ select private.pas_provision_center(p_profile,p_actor,p_type,p_name,p_license) $$;
revoke all on function private.pas_provision_center(uuid,uuid,text,text,text),public.pas_provision_center(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.pas_provision_center(uuid,uuid,text,text,text),public.pas_provision_center(uuid,uuid,text,text,text) to service_role;

alter table public.pas_provider_services drop constraint pas_provider_services_service_kind_check;
alter table public.pas_provider_services add constraint pas_provider_services_service_kind_check check(service_kind in ('ct','mri','ecg','ultrasound','mammography','xray','physiotherapy','other'));
alter table public.pas_medical_requests drop constraint pas_medical_requests_service_kind_check;
alter table public.pas_medical_requests add constraint pas_medical_requests_service_kind_check check(service_kind in ('ct','mri','ecg','ultrasound','mammography','xray','physiotherapy','other'));
alter table public.pas_medical_requests add column service_details jsonb not null default '{}'::jsonb check(jsonb_typeof(service_details)='object' and pg_column_size(service_details)<=16384);

create table public.pas_therapy_sessions (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.pas_medical_requests(id),
 provider_id uuid not null references public.laboratory_profiles(id),
 patient_id uuid not null references public.patient_profiles(id),
 session_number integer not null check(session_number between 1 and 100),
 occurred_at timestamptz not null,
 interventions text not null check(length(btrim(interventions)) between 5 and 4000),
 progress_note text not null check(length(btrim(progress_note)) between 5 and 4000),
 created_at timestamptz not null default now(),
 unique(request_id,session_number)
);
create index pas_therapy_patient_idx on public.pas_therapy_sessions(patient_id,occurred_at);
create index pas_therapy_provider_idx on public.pas_therapy_sessions(provider_id,occurred_at);
alter table public.pas_therapy_sessions enable row level security;
revoke all on public.pas_therapy_sessions from public,anon,authenticated;
grant select on public.pas_therapy_sessions to authenticated;
grant all on public.pas_therapy_sessions to service_role;
create policy pas_therapy_read on public.pas_therapy_sessions for select to authenticated using(
 patient_id=(select auth.uid()) or private.pas_can_read(patient_id,'diagnostics') or
 (provider_id=(select auth.uid()) and private.pas_center_accepts(provider_id,'physiotherapy')));

create or replace function private.pas_service_providers() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(
 select c.profile_id as provider_id,p.full_name,c.display_name,c.center_type,array[private.pas_center_service(c.center_type)] as services
 from public.pas_medical_centers c join public.profiles p on p.id=c.profile_id
 where auth.uid() is not null and p.role='laboratory' and c.is_active and c.center_type<>'laboratory'
 order by c.display_name,c.profile_id limit 200)q
$$;

-- Defense for both direct Data API access and older SECURITY DEFINER RPCs.
create function private.pas_lab_boundary() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.pas_role()='laboratory' and not private.pas_is_lab(auth.uid()) then
  raise exception 'This medical center is not licensed as a laboratory' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['lab_orders','lab_order_items','diagnostic_reports','observations','attachments','guest_result_accesses','lab_dispatches','home_collection_requests'] loop
  execute format('create policy pas_lab_type_boundary on public.%I as restrictive for all to authenticated using (private.pas_role() is distinct from ''laboratory'' or private.pas_is_lab(auth.uid())) with check (private.pas_role() is distinct from ''laboratory'' or private.pas_is_lab(auth.uid()))',t);
  execute format('create trigger pas_lab_type_boundary before insert or update or delete on public.%I for each row execute function private.pas_lab_boundary()',t);
 end loop;
end $$;

create or replace function public.is_laboratory_branch_member(p_branch_id uuid,p_profile_id uuid default auth.uid()) returns boolean language sql stable set search_path='' as $$
 select p_profile_id is not distinct from auth.uid() and private.pas_is_lab(auth.uid()) and exists(select 1 from public.laboratory_branch_members m where m.branch_id=p_branch_id and m.profile_id=auth.uid() and m.is_active)
$$;
create or replace function public.is_laboratory_branch_result_member(p_branch_id uuid,p_profile_id uuid default auth.uid()) returns boolean language sql stable set search_path='' as $$
 select p_profile_id is not distinct from auth.uid() and private.pas_is_lab(auth.uid()) and exists(select 1 from public.laboratory_branch_members m where m.branch_id=p_branch_id and m.profile_id=auth.uid() and m.is_active and m.role_in_branch in ('manager','laboratory_staff','member'))
$$;
create policy pas_medical_center_boundary on public.pas_medical_requests as restrictive for select to authenticated using(
 private.pas_role() is distinct from 'laboratory' or (provider_id=auth.uid() and private.pas_center_accepts(provider_id,service_kind)));
create policy pas_medical_result_center_boundary on public.pas_medical_results as restrictive for select to authenticated using(
 private.pas_role() is distinct from 'laboratory' or exists(select 1 from public.pas_medical_requests r where r.id=request_id and r.provider_id=auth.uid() and private.pas_center_accepts(r.provider_id,r.service_kind)));
create function private.pas_guard_provider_services() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.is_service_role() and not (private.pas_role()='admin' and exists(select 1 from public.admin_profiles where id=auth.uid())) then
  raise exception 'Provider services are administrator controlled' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
alter policy pas_provider_read on public.pas_provider_services using(private.pas_center_accepts(provider_id,service_kind));
create trigger pas_guard_provider_services before insert or update or delete on public.pas_provider_services for each row execute function private.pas_guard_provider_services();

-- Restrict public execution to the new dispatcher; its old implementation will
-- be retained below only as a private internal helper with no client grants.

CREATE OR REPLACE FUNCTION private.pas_care_command_v1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid:=auth.uid(); role_name text; target uuid; rid uuid; v_id uuid; n numeric;
 scopes text[]; r record; v_cons public.pas_consultations%rowtype;
 v_visit public.visits%rowtype; v_rx public.prescriptions%rowtype;
 v_med public.pas_medical_requests%rowtype; v_delivery public.pas_pharmacy_requests%rowtype;
 v_identity public.pas_identity_requests%rowtype; item jsonb;
 v_at timestamptz; v_status text; v_path text; v_mime text; v_size bigint;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 role_name:=private.pas_role();
 if role_name is null or jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>32768 then
  raise exception 'Invalid command payload';
 end if;
 if role_name='admin' and not exists(select 1 from public.admin_profiles where id=u) then raise exception 'Admin profile required' using errcode='42501'; end if;
 if role_name='doctor' and not exists(select 1 from public.doctor_profiles where id=u and is_verified) then
  raise exception 'Verified doctor required' using errcode='42501';
 end if;
 case p_action
 when 'profile.update' then
  if length(btrim(coalesce(p_payload->>'full_name',''))) not between 2 and 150 then raise exception 'Invalid full name'; end if;
  update public.profiles set full_name=btrim(p_payload->>'full_name') where id=u;
  if role_name='doctor' and p_payload ? 'specialty' then
   if length(coalesce(p_payload->>'specialty',''))>150 then raise exception 'Invalid specialty'; end if;
   update public.doctor_profiles set specialty=nullif(btrim(p_payload->>'specialty'),'') where id=u;
  end if;
  return jsonb_build_object('id',u);
 when 'identity.request' then
  v_path:=nullif(p_payload->>'phone','');
  v_status:=nullif(p_payload->>'national_id','');
  if v_path is not null and v_path !~ '^989[0-9]{9}$' then raise exception 'Invalid phone'; end if;
  if v_status is not null and not private.pas_valid_national_id(v_status) then raise exception 'Invalid national ID'; end if;
  if v_path is null and v_status is null then raise exception 'No identity change requested'; end if;
  if exists(select 1 from public.profiles where id<>u and (phone=v_path or national_id=v_status)) then
   raise exception 'Identity already in use';
  end if;
  insert into public.pas_identity_requests(profile_id,requested_phone,requested_national_id)
  values(u,v_path,v_status) returning id into v_id;
  return jsonb_build_object('id',v_id);
 when 'identity.review' then
  if role_name<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
  select * into v_identity from public.pas_identity_requests where id=(p_payload->>'id')::uuid for update;
  if not found or v_identity.status not in ('pending','processing') then raise exception 'Request is not open'; end if;
  if p_payload->>'decision'='reject' then
   if v_identity.status<>'pending' then raise exception 'Request is processing'; end if;
   update public.pas_identity_requests set status='rejected',reviewer_id=u,reviewed_at=now(),
    review_note=left(p_payload->>'note',1000) where id=v_identity.id;
  elsif p_payload->>'decision'='approve' then
   if v_identity.status='processing' and v_identity.reviewer_id<>u then raise exception 'Another reviewer is processing this request'; end if;
   update public.pas_identity_requests set status='processing',reviewer_id=u where id=v_identity.id;
  else raise exception 'Invalid identity review'; end if;
  return to_jsonb(v_identity);
 when 'access.set' then
  if role_name<>'patient' then raise exception 'Patient required' using errcode='42501'; end if;
  target:=(p_payload->>'doctor_id')::uuid;
  if not exists(select 1 from public.patient_doctor_relationships where patient_id=u and doctor_id=target and status='active') then
   raise exception 'Active relationship required';
  end if;
  select coalesce(array_agg(distinct x),'{}') into scopes from jsonb_array_elements_text(p_payload->'scopes') x;
  v_at:=nullif(p_payload->>'expires_at','')::timestamptz;
  if v_at is not null and v_at<=now() then raise exception 'Access expiry must be in the future'; end if;
  insert into public.pas_record_access(patient_id,doctor_id,scopes,expires_at)
  values(u,target,scopes,v_at) on conflict(patient_id,doctor_id)
  do update set scopes=excluded.scopes,expires_at=excluded.expires_at,updated_at=now();
  return jsonb_build_object('id',target);
 when 'relationship.respond' then
  if role_name<>'patient' then raise exception 'Patient required' using errcode='42501'; end if;
  rid:=(p_payload->>'id')::uuid;
  select * into r from public.patient_doctor_relationships where id=rid and patient_id=u for update;
  if not found then raise exception 'Relationship not found'; end if;
  item:=public.respond_to_doctor_request(rid,p_payload->>'decision');
  if not coalesce((item->>'ok')::boolean,false) then raise exception 'Relationship response rejected'; end if;
  if p_payload->>'decision'='accept' then
   select coalesce(array_agg(distinct x),'{}') into scopes from jsonb_array_elements_text(coalesce(p_payload->'scopes','[]')) x;
   insert into public.pas_record_access(patient_id,doctor_id,scopes) values(u,r.doctor_id,scopes)
   on conflict(patient_id,doctor_id) do update set scopes=excluded.scopes,expires_at=null,updated_at=now();
  end if;
  return item;
 when 'availability.set' then
  if role_name<>'doctor' then raise exception 'Doctor required' using errcode='42501'; end if;
  insert into public.pas_doctor_availability(doctor_id,is_available,expires_at,capacity)
  values(u,coalesce((p_payload->>'is_available')::boolean,false),now()+interval '1 hour',
    coalesce((p_payload->>'capacity')::smallint,1))
  on conflict(doctor_id) do update set is_available=excluded.is_available,expires_at=excluded.expires_at,
    capacity=excluded.capacity,updated_at=now();
  return jsonb_build_object('id',u);
 when 'consultation.request' then
  if role_name<>'patient' or not exists(select 1 from public.patient_profiles where id=u) then
   raise exception 'Completed patient profile required' using errcode='42501';
  end if;
  target:=(p_payload->>'doctor_id')::uuid;
  if not exists(select 1 from public.doctor_profiles d join public.profiles p on p.id=d.id
    where d.id=target and d.is_verified and p.role='doctor') then raise exception 'Doctor unavailable'; end if;
  select * into r from public.patient_doctor_relationships where patient_id=u and doctor_id=target
    and status in ('active','pending') order by (status='active') desc limit 1 for update;
  rid:=r.id;
  if not exists(select 1 from public.pas_doctor_availability a where a.doctor_id=target and a.is_available and a.expires_at>now()
    and (select count(*) from public.pas_consultations c where c.doctor_id=target and c.status='accepted')<a.capacity)
    and not exists(select 1 from public.patient_doctor_relationships where id=rid and status='active') then
   raise exception 'Doctor unavailable';
  end if;
  if length(btrim(coalesce(p_payload->>'reason',''))) not between 5 and 2500 then raise exception 'Invalid consultation reason'; end if;
  select coalesce(array_agg(distinct x),'{}') into scopes from jsonb_array_elements_text(coalesce(p_payload->'scopes','[]')) x;
  -- The patient explicitly grants visit access for the requested consultation.
  scopes:=array(select distinct x from unnest(scopes||array['visits']) x);
  if rid is null then
   insert into public.patient_doctor_relationships(patient_id,doctor_id,created_by,status,relationship_type)
   values(u,target,u,'pending','consulting') returning id into rid;
  elsif r.status='pending' and r.created_by<>u then
   update public.patient_doctor_relationships set status='active' where id=rid;
  end if;
  insert into public.pas_record_access(patient_id,doctor_id,scopes,expires_at)
  values(u,target,scopes,now()+interval '7 days') on conflict(patient_id,doctor_id) do update set
   scopes=case when pas_record_access.expires_at<=now() or cardinality(pas_record_access.scopes)=0 then excluded.scopes
     else array(select distinct x from unnest(pas_record_access.scopes||excluded.scopes) x) end,
   expires_at=case when pas_record_access.expires_at<=now() or cardinality(pas_record_access.scopes)=0 then excluded.expires_at
     else pas_record_access.expires_at end,updated_at=now();
  insert into public.pas_consultations(patient_id,doctor_id,relationship_id,reason,consent_scopes)
  values(u,target,rid,btrim(p_payload->>'reason'),scopes) returning id into v_id;
  return jsonb_build_object('id',v_id);
 when 'consultation.accept' then
  if role_name<>'doctor' then raise exception 'Doctor required' using errcode='42501'; end if;
  -- Lock the doctor's capacity before the request to serialize concurrent accepts.
  insert into public.pas_doctor_availability(doctor_id) values(u) on conflict do nothing;
  perform 1 from public.pas_doctor_availability where doctor_id=u for update;
  select * into v_cons from public.pas_consultations where id=(p_payload->>'id')::uuid and doctor_id=u for update;
  if not found or v_cons.status<>'requested' then raise exception 'Request is no longer open'; end if;
  if (select count(*) from public.pas_consultations where doctor_id=u and status='accepted')>=
    (select capacity from public.pas_doctor_availability where doctor_id=u) then raise exception 'Consultation capacity reached'; end if;
  select * into r from public.patient_doctor_relationships where id=v_cons.relationship_id for update;
  if r.status='pending' and r.created_by=v_cons.patient_id then
   update public.patient_doctor_relationships set status='active' where id=r.id;
  elsif r.status is distinct from 'active' then raise exception 'Patient authorization is no longer active'; end if;
  if not private.pas_can_read(v_cons.patient_id,'visits') then raise exception 'Patient visit access is not active'; end if;
  insert into public.visits(patient_id,doctor_id,status) values(v_cons.patient_id,u,'scheduled') returning id into v_id;
  update public.visits set status='in_progress' where id=v_id;
  update public.pas_consultations set status='accepted',visit_id=v_id,accepted_at=now() where id=v_cons.id;
  return jsonb_build_object('id',v_cons.id,'visit_id',v_id);
 when 'consultation.cancel' then
  select * into v_cons from public.pas_consultations where id=(p_payload->>'id')::uuid for update;
  if not found or v_cons.status<>'requested' then raise exception 'Request is no longer open'; end if;
  if v_cons.patient_id=u and role_name='patient' then v_status:='cancelled';
  elsif v_cons.doctor_id=u and role_name='doctor' then v_status:='declined';
  else raise exception 'Consultation access denied' using errcode='42501'; end if;
  update public.pas_consultations set status=v_status,completed_at=now() where id=v_cons.id;
  return jsonb_build_object('id',v_cons.id);
 when 'consultation.message' then
  select * into v_cons from public.pas_consultations where id=(p_payload->>'consultation_id')::uuid for update;
  if not found or v_cons.status<>'accepted' or not private.pas_in_consultation(v_cons.id) then
   raise exception 'Active consultation access required' using errcode='42501';
  end if;
  v_id:=(p_payload->>'id')::uuid;
  v_path:=nullif(p_payload->>'audio_path','');
  if v_path is not null then
   if v_path !~ ('^'||v_cons.id::text||'/'||u::text||'/'||v_id::text||'\.(webm|ogg|m4a|mp3)$') then
    raise exception 'Invalid consultation audio path';
   end if;
   select lower(metadata->>'mimetype'),(metadata->>'size')::bigint into v_mime,v_size
    from storage.objects where bucket_id='pas-consultations' and name=v_path;
   if v_size is null or v_size not between 1 and 2097152 or v_mime not in
    ('audio/webm','audio/ogg','audio/mp4','audio/mpeg') then raise exception 'Invalid consultation audio object'; end if;
  end if;
  insert into public.pas_consultation_messages(id,consultation_id,sender_id,body,audio_path)
  values(v_id,v_cons.id,u,nullif(btrim(p_payload->>'body'),''),v_path) on conflict(id) do nothing;
  if not exists(select 1 from public.pas_consultation_messages where id=v_id and sender_id=u and consultation_id=v_cons.id) then
   raise exception 'Message identity conflict';
  end if;
  return jsonb_build_object('id',v_id);
 when 'visit.close' then
  if role_name<>'doctor' then raise exception 'Doctor required' using errcode='42501'; end if;
  select * into v_visit from public.visits where id=(p_payload->>'visit_id')::uuid and doctor_id=u for update;
  if not found or v_visit.status='cancelled' or not private.pas_can_read(v_visit.patient_id,'visits') then
   raise exception 'Visit access denied' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_payload->>'summary',''))) not between 10 and 12000 then raise exception 'Invalid visit summary'; end if;
  insert into public.pas_visit_closures(visit_id,patient_id,doctor_id,summary)
  values(v_visit.id,v_visit.patient_id,u,btrim(p_payload->>'summary'))
  on conflict(visit_id) do update set summary=excluded.summary,updated_at=now();
  if v_visit.status='scheduled' then update public.visits set status='in_progress' where id=v_visit.id; end if;
  update public.visits set status='completed' where id=v_visit.id and status='in_progress';
  return jsonb_build_object('id',v_visit.id);
 when 'provider.services' then
  if role_name<>'laboratory' or not exists(select 1 from public.laboratory_profiles where id=u) then
   raise exception 'Provider required' using errcode='42501'; end if;
  select coalesce(array_agg(distinct x),'{}') into scopes from jsonb_array_elements_text(p_payload->'services') x;
  if not scopes<@array['ct','mri','ecg','ultrasound','mammography','xray','other']::text[] then raise exception 'Invalid services'; end if;
  delete from public.pas_provider_services where provider_id=u;
  insert into public.pas_provider_services(provider_id,service_kind) select u,x from unnest(scopes) x;
  return jsonb_build_object('id',u);
 when 'medical.request' then
  if role_name<>'doctor' then raise exception 'Doctor required' using errcode='42501'; end if;
  target:=(p_payload->>'patient_id')::uuid;
  if not private.pas_can_read(target,'diagnostics') then raise exception 'Diagnostic access required' using errcode='42501'; end if;
  rid:=nullif(p_payload->>'provider_id','')::uuid;
  if rid is not null and not exists(select 1 from public.pas_provider_services where provider_id=rid and service_kind=p_payload->>'service_kind') then
   raise exception 'Provider does not offer this service'; end if;
  insert into public.pas_medical_requests(patient_id,doctor_id,provider_id,service_kind,service_name,clinical_note,scheduled_at)
  values(target,u,rid,p_payload->>'service_kind',btrim(p_payload->>'service_name'),nullif(p_payload->>'clinical_note',''),
    nullif(p_payload->>'scheduled_at','')::timestamptz) returning id into v_id;
  return jsonb_build_object('id',v_id);
 when 'medical.assign' then
  select * into v_med from public.pas_medical_requests where id=(p_payload->>'id')::uuid for update;
  if role_name<>'patient' or v_med.patient_id is distinct from u or v_med.provider_id is not null or v_med.status<>'requested' then
   raise exception 'Service assignment denied' using errcode='42501'; end if;
  target:=(p_payload->>'provider_id')::uuid;
  if not exists(select 1 from public.pas_provider_services where provider_id=target and service_kind=v_med.service_kind) then
   raise exception 'Provider does not offer this service'; end if;
  update public.pas_medical_requests set provider_id=target where id=v_med.id;
  return jsonb_build_object('id',v_med.id);
 when 'medical.advance' then
  select * into v_med from public.pas_medical_requests where id=(p_payload->>'id')::uuid for update;
  if not found or role_name<>'laboratory' or v_med.provider_id is distinct from u then
   raise exception 'Provider access denied' using errcode='42501'; end if;
  v_status:=p_payload->>'status';
  if not ((v_med.status='requested' and v_status in ('accepted','cancelled')) or
    (v_med.status='accepted' and v_status in ('in_progress','cancelled'))) then raise exception 'Invalid service transition'; end if;
  update public.pas_medical_requests set status=v_status where id=v_med.id;
  return jsonb_build_object('id',v_med.id);
 when 'medical.finish' then
  select * into v_med from public.pas_medical_requests where id=(p_payload->>'id')::uuid for update;
  if not found or role_name<>'laboratory' or v_med.provider_id is distinct from u then
   raise exception 'Provider access denied' using errcode='42501'; end if;
  if v_med.status not in ('accepted','in_progress','reported') then raise exception 'Service is not reportable'; end if;
  rid:=nullif(p_payload->>'supersedes_id','')::uuid;
  if v_med.status='reported' and (rid is null or not exists(select 1 from public.pas_medical_results x
    where x.id=rid and x.request_id=v_med.id and not exists(select 1 from public.pas_medical_results y where y.supersedes_id=x.id))) then
   raise exception 'Correction must supersede the current report'; end if;
  if v_med.status<>'reported' and rid is not null then raise exception 'No report to supersede'; end if;
  v_path:=nullif(p_payload->>'attachment_path','');
  if v_path is not null then
   if v_path !~ ('^'||v_med.id::text||'/'||u::text||'/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg)$') then raise exception 'Invalid attachment path'; end if;
   select lower(metadata->>'mimetype'),(metadata->>'size')::bigint into v_mime,v_size
    from storage.objects where bucket_id='pas-medical-documents' and name=v_path;
   if v_size is null or v_size not between 1 and 20971520 or v_mime not in
    ('application/pdf','image/png','image/jpeg') then raise exception 'Invalid medical attachment'; end if;
  end if;
  insert into public.pas_medical_results(request_id,provider_id,conclusion,measurements,attachment_path,supersedes_id)
  values(v_med.id,u,btrim(p_payload->>'conclusion'),coalesce(p_payload->'measurements','{}'),v_path,rid) returning id into v_id;
  update public.pas_medical_requests set status='reported',completed_at=coalesce(completed_at,now()) where id=v_med.id;
  return jsonb_build_object('id',v_id);
 when 'medication.received' then
  rid:=(p_payload->>'item_id')::uuid;
  select p.* into v_rx from public.prescriptions p join public.prescription_items i on i.prescription_id=p.id where i.id=rid;
  if role_name<>'patient' or v_rx.patient_id is distinct from u or v_rx.status::text<>'active' then
   raise exception 'Prescription access denied' using errcode='42501'; end if;
  v_at:=(p_payload->>'received_at')::timestamptz;
  if v_at is null or (v_at at time zone 'Asia/Tehran')::date<(v_rx.issued_at at time zone 'Asia/Tehran')::date then
   raise exception 'Receipt precedes prescription'; end if;
  v_id:=(p_payload->>'id')::uuid;
  insert into public.pas_medication_dispenses(id,prescription_item_id,patient_id,quantity_units,received_at,source,recorded_by)
  values(v_id,rid,u,(p_payload->>'quantity_units')::numeric,v_at,'patient',u) on conflict(id) do nothing;
  if not exists(select 1 from public.pas_medication_dispenses where id=v_id and patient_id=u and prescription_item_id=rid) then
   raise exception 'Receipt identity conflict'; end if;
  return jsonb_build_object('id',v_id);
 when 'pharmacy.request' then
  if role_name<>'patient' or coalesce((p_payload->>'consent')::boolean,false) is not true then raise exception 'Patient delivery consent required'; end if;
  rid:=(p_payload->>'prescription_id')::uuid;
  if not exists(select 1 from public.prescriptions where id=rid and patient_id=u and status::text='active') then
   raise exception 'Prescription access denied' using errcode='42501'; end if;
  insert into public.pas_pharmacy_requests(patient_id,prescription_id,delivery_address,contact_phone)
  values(u,rid,btrim(p_payload->>'address'),p_payload->>'phone') returning id into v_id;
  return jsonb_build_object('id',v_id);
 when 'pharmacy.cancel' then
  select * into v_delivery from public.pas_pharmacy_requests where id=(p_payload->>'id')::uuid for update;
  if v_delivery.patient_id is distinct from u or v_delivery.status not in ('submitted','reviewing') then
   raise exception 'Delivery cancellation denied' using errcode='42501'; end if;
  update public.pas_pharmacy_requests set status='cancelled',updated_at=now() where id=v_delivery.id;
  return jsonb_build_object('id',v_delivery.id);
 when 'pharmacy.advance' then
  if role_name<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
  select * into v_delivery from public.pas_pharmacy_requests where id=(p_payload->>'id')::uuid for update;
  if not found then raise exception 'Delivery not found'; end if;
  v_status:=p_payload->>'status';
  if not ((v_delivery.status='submitted' and v_status in ('reviewing','rejected')) or
   (v_delivery.status='reviewing' and v_status in ('preparing','rejected')) or
   (v_delivery.status='preparing' and v_status in ('dispatched','rejected')) or
   (v_delivery.status='dispatched' and v_status='delivered')) then raise exception 'Invalid delivery transition'; end if;
  if v_status in ('preparing','dispatched','delivered') and length(btrim(coalesce(p_payload->>'pharmacy_name',v_delivery.pharmacy_name,'')))<2 then
   raise exception 'Pharmacy name required'; end if;
  if v_status='delivered' then
   if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')=0 then
    raise exception 'Actual dispensed quantities required';
   end if;
   if (select count(*) from jsonb_array_elements(p_payload->'items'))<>(select count(distinct x->>'item_id') from jsonb_array_elements(p_payload->'items') x) then raise exception 'Duplicate dispense items'; end if;
   for item in select value from jsonb_array_elements(p_payload->'items') loop
    rid:=(item->>'item_id')::uuid;
    if not exists(select 1 from public.prescription_items where id=rid and prescription_id=v_delivery.prescription_id) then
     raise exception 'Dispensed item does not belong to this prescription'; end if;
    insert into public.pas_medication_dispenses(id,prescription_item_id,patient_id,quantity_units,received_at,source,recorded_by,external_reference)
    values(gen_random_uuid(),rid,v_delivery.patient_id,(item->>'quantity_units')::numeric,now(),'admin',u,v_delivery.id::text);
   end loop;
  end if;
  update public.pas_pharmacy_requests set status=v_status,pharmacy_name=coalesce(nullif(p_payload->>'pharmacy_name',''),pharmacy_name),
   tracking_reference=coalesce(nullif(p_payload->>'tracking_reference',''),tracking_reference),
   review_note=left(p_payload->>'note',1000),updated_at=now(),
   delivered_at=case when v_status='delivered' then now() else delivered_at end where id=v_delivery.id;
  return jsonb_build_object('id',v_delivery.id);
 when 'integration.configure' then
  if role_name<>'admin' then raise exception 'Admin required' using errcode='42501'; end if;
  update public.pas_integration_connections set enabled=(p_payload->>'enabled')::boolean
   where provider_key=p_payload->>'provider_key';
  if not found then raise exception 'Unknown integration provider'; end if;
  return jsonb_build_object('provider_key',p_payload->>'provider_key');
 else raise exception 'Unsupported care command';
 end case;
end $function$;


revoke all on function private.pas_care_command_v1(text,jsonb) from public,anon,authenticated;

create or replace function private.pas_care_command(p_action text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.pas_medical_requests%rowtype; out_data jsonb; fields text[];
 details jsonb:=coalesce(p_payload->'measurements','{}'); row_id uuid; v_number integer; previous public.pas_therapy_sessions%rowtype;
begin
 if u is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Authentication and object payload required' using errcode='42501'; end if;
 if p_action='provider.services' then raise exception 'Center type and services are administrator controlled' using errcode='42501'; end if;
 if p_action='center.status' then
  if private.pas_role()<>'admin' or not exists(select 1 from public.admin_profiles where id=u) then raise exception 'Administrator required' using errcode='42501'; end if;
  if jsonb_typeof(p_payload->'is_active') is distinct from 'boolean' then raise exception 'Boolean status required' using errcode='23514'; end if;
  row_id:=(p_payload->>'id')::uuid;
  update public.pas_medical_centers set is_active=(p_payload->>'is_active')::boolean where profile_id=row_id;
  if not found then raise exception 'Center not found'; end if;
  return jsonb_build_object('id',row_id);
 end if;
 if p_action='medical.request' then
  if nullif(p_payload->>'provider_id','') is not null and not private.pas_center_accepts((p_payload->>'provider_id')::uuid,p_payload->>'service_kind') then raise exception 'Center type does not match requested service' using errcode='42501'; end if;
  details:=coalesce(p_payload->'service_details','{}');
  if jsonb_typeof(details)<>'object' or pg_column_size(details)>16384 or exists(select 1 from jsonb_object_keys(details) k where k not in ('body_region','requested_sessions','preparation')) then raise exception 'Invalid request details' using errcode='23514'; end if;
  if exists(select 1 from jsonb_each(details) d where d.key in ('body_region','preparation') and (jsonb_typeof(d.value)<>'string' or length(d.value#>>'{}')>2000)) then raise exception 'Invalid request details' using errcode='23514'; end if;
  if details ? 'requested_sessions' and ((details->>'requested_sessions')!~'^[0-9]{1,3}$' or (details->>'requested_sessions')::int not between 1 and 100 or p_payload->>'service_kind'<>'physiotherapy') then raise exception 'Invalid session count' using errcode='23514'; end if;
  out_data:=private.pas_care_command_v1(p_action,p_payload);
  update public.pas_medical_requests set service_details=details where id=(out_data->>'id')::uuid;
  return out_data;
 end if;
 if p_action in ('medical.assign','medical.advance','medical.finish','medical.session','medical.schedule') then
  select * into r from public.pas_medical_requests where id=(p_payload->>'id')::uuid for update;
  if not found then raise exception 'Request not found' using errcode='42501'; end if;
  if p_action='medical.assign' then
   if not private.pas_center_accepts((p_payload->>'provider_id')::uuid,r.service_kind) then raise exception 'Center type does not match requested service' using errcode='42501'; end if;
  else
   if private.pas_role()<>'laboratory' or r.provider_id is distinct from u or not private.pas_center_accepts(u,r.service_kind) then raise exception 'Assigned licensed center required' using errcode='42501'; end if;
  end if;
  if p_action='medical.schedule' then
   if r.status not in ('accepted','in_progress') or nullif(p_payload->>'scheduled_at','') is null or (p_payload->>'scheduled_at')::timestamptz<now()-interval '5 minutes' then raise exception 'Invalid appointment' using errcode='23514'; end if;
   update public.pas_medical_requests set scheduled_at=(p_payload->>'scheduled_at')::timestamptz where id=r.id;
   return jsonb_build_object('id',r.id);
  end if;
  if p_action='medical.session' then
   if r.service_kind<>'physiotherapy' or r.status not in ('accepted','in_progress') then raise exception 'Active physiotherapy course required' using errcode='42501'; end if;
   row_id:=coalesce(nullif(p_payload->>'session_id','')::uuid,gen_random_uuid());
   v_number:=(p_payload->>'session_number')::integer;
   select * into previous from public.pas_therapy_sessions where id=row_id;
   if found then
    if previous.request_id=r.id and previous.provider_id=u and previous.session_number=v_number and previous.occurred_at=(p_payload->>'occurred_at')::timestamptz and previous.interventions=btrim(p_payload->>'interventions') and previous.progress_note=btrim(p_payload->>'progress_note') then return jsonb_build_object('id',row_id); end if;
    raise exception 'Session identifier reused' using errcode='23505';
   end if;
   if v_number is distinct from (select count(*)+1 from public.pas_therapy_sessions where request_id=r.id) or
    (r.service_details ? 'requested_sessions' and v_number>(r.service_details->>'requested_sessions')::integer) or
    (p_payload->>'occurred_at')::timestamptz>now()+interval '5 minutes' then raise exception 'Invalid session order or date' using errcode='23514'; end if;
   insert into public.pas_therapy_sessions(id,request_id,provider_id,patient_id,session_number,occurred_at,interventions,progress_note)
    values(row_id,r.id,u,r.patient_id,v_number,(p_payload->>'occurred_at')::timestamptz,btrim(p_payload->>'interventions'),btrim(p_payload->>'progress_note'));
   update public.pas_medical_requests set status='in_progress' where id=r.id;
   return jsonb_build_object('id',row_id);
  end if;
  if p_action='medical.finish' then
   fields:=case r.service_kind
    when 'xray' then array['body_region','views','findings','impression']
    when 'mri' then array['body_region','protocol','contrast','findings','impression']
    when 'ct' then array['body_region','technique','contrast','findings','impression']
    when 'ultrasound' then array['body_region','technique','measurements','findings','impression']
    when 'mammography' then array['laterality','views','comparison','findings','impression']
    when 'ecg' then array['rhythm','rate','intervals','findings','impression']
    when 'physiotherapy' then array['assessment','goals','plan','outcome']
    else array['procedure','findings','impression'] end;
   if jsonb_typeof(details)<>'object' or pg_column_size(details)>20000 or exists(select 1 from jsonb_each(details) d where not d.key=any(fields) or jsonb_typeof(d.value)<>'string' or length(d.value#>>'{}')>4000) then raise exception 'Report fields do not match center modality' using errcode='23514'; end if;
   if r.service_kind='physiotherapy' then fields:=array['assessment','outcome']; elsif r.service_kind='other' then fields:=array['procedure','impression']; else fields:=array['findings','impression']; end if;
   if exists(select 1 from unnest(fields) k where coalesce(length(btrim(details->>k)),0)<5) then raise exception 'Required clinical report sections missing' using errcode='23514'; end if;
  end if;
 end if;
 return private.pas_care_command_v1(p_action,p_payload);
end $$;

create index pas_medical_provider_schedule_idx on public.pas_medical_requests(provider_id,scheduled_at);
create function private.pas_center_worklist(p_request uuid default null,p_page integer default 1,p_status text default null,p_query text default null,p_from timestamptz default null,p_to timestamptz default null) returns jsonb language sql stable security definer set search_path='' as $$
 with visible as materialized (
 select r.*,p.full_name as patient_name,d.full_name as doctor_name from public.pas_medical_requests r
 join public.profiles p on p.id=r.patient_id join public.profiles d on d.id=r.doctor_id
 where r.provider_id=auth.uid() and private.pas_role()='laboratory' and private.pas_center_accepts(r.provider_id,r.service_kind)
 ), filtered as materialized (
 select * from visible where (p_request is null or id=p_request) and (p_status is null or status=p_status)
 and (p_query is null or patient_name ilike '%'||left(p_query,100)||'%' or service_name ilike '%'||left(p_query,100)||'%')
 and (p_from is null or scheduled_at>=p_from) and (p_to is null or scheduled_at<p_to)
 ), paged as (
 select * from filtered order by requested_at desc,id limit case when p_request is not null then 1 when p_from is not null then 500 else 20 end
 offset case when p_request is not null or p_from is not null then 0 else (greatest(1,least(coalesce(p_page,1),10000))-1)*20 end
 )
 select jsonb_build_object('total',(select count(*) from filtered),'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from visible group by status)c),
 'items',(select coalesce(jsonb_agg(to_jsonb(q) order by q.requested_at desc,q.id),'[]') from(
 select r.*,coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.pas_medical_results x where x.request_id=r.id),'[]') as pas_medical_results,
 coalesce((select jsonb_agg(to_jsonb(t) order by t.session_number) from public.pas_therapy_sessions t where t.request_id=r.id),'[]') as pas_therapy_sessions from paged r)q))
$$;
create function public.pas_center_worklist(p_request uuid default null,p_page integer default 1,p_status text default null,p_query text default null,p_from timestamptz default null,p_to timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$ select private.pas_center_worklist(p_request,p_page,p_status,p_query,p_from,p_to) $$;
revoke all on function private.pas_center_worklist(uuid,integer,text,text,timestamptz,timestamptz),public.pas_center_worklist(uuid,integer,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function private.pas_center_worklist(uuid,integer,text,text,timestamptz,timestamptz),public.pas_center_worklist(uuid,integer,text,text,timestamptz,timestamptz) to authenticated;

create function private.pas_guard_lab_membership_type() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.pas_is_lab(new.profile_id) then raise exception 'Laboratory membership requires an active laboratory identity' using errcode='42501'; end if;
 return new;
end $$;
create trigger pas_lab_membership_type before insert or update on public.laboratory_branch_members for each row execute function private.pas_guard_lab_membership_type();
create function private.pas_center_identity_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(coalesce(auth.uid(),new.created_by),'center.'||lower(tg_op),'pas_medical_centers',new.profile_id,jsonb_build_object('center_type',new.center_type,'is_active',new.is_active));
 return new;
end $$;
revoke all on function private.pas_center_identity_audit() from public,anon,authenticated;
create trigger pas_center_audit after insert or update on public.pas_medical_centers for each row execute function private.pas_center_identity_audit();
create trigger pas_therapy_audit after insert on public.pas_therapy_sessions for each row execute function private.pas_audit_change();

-- Internal trigger functions are not direct RPC entry points.
revoke all on function private.pas_guard_center(),private.pas_seed_lab_identity(),private.pas_lab_boundary(),private.pas_guard_provider_services(),private.pas_guard_lab_membership_type() from public,anon,authenticated;
notify pgrst,'reload schema';
