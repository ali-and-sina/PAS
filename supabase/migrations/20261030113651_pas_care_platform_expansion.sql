-- Additive care workflows. Existing clinical rows and identifiers are preserved.
set lock_timeout = '5s';
set statement_timeout = '90s';
create schema if not exists private;

create table public.pas_record_access (
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.doctor_profiles(id),
  scopes text[] not null default '{}',
  expires_at timestamptz,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (patient_id, doctor_id),
  check (patient_id <> doctor_id),
  check (scopes <@ array['labs','medications','visits','follow_ups','diagnostics']::text[])
);
create index pas_record_access_doctor_idx on public.pas_record_access(doctor_id, patient_id);
-- Carry forward access already approved through an existing active relationship.
insert into public.pas_record_access(patient_id,doctor_id,scopes)
select distinct patient_id,doctor_id,array['labs','medications','visits','follow_ups','diagnostics']
from public.patient_doctor_relationships where status='active'
on conflict do nothing;

create table public.pas_identity_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  requested_phone text,
  requested_national_id text,
  status text not null default 'pending' check(status in ('pending','processing','approved','rejected')),
  reviewer_id uuid references public.profiles(id),
  review_note text check(length(review_note)<=1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check(requested_phone is not null or requested_national_id is not null),
  check(requested_phone is null or requested_phone ~ '^989[0-9]{9}$'),
  check(requested_national_id is null or requested_national_id ~ '^[0-9]{10}$')
);
create unique index pas_identity_one_open_idx on public.pas_identity_requests(profile_id)
where status in ('pending','processing');
create unique index pas_identity_phone_reservation_idx on public.pas_identity_requests(requested_phone) where status in ('pending','processing') and requested_phone is not null;
create unique index pas_identity_national_reservation_idx on public.pas_identity_requests(requested_national_id) where status in ('pending','processing') and requested_national_id is not null;
create index pas_identity_history_idx on public.pas_identity_requests(profile_id,created_at);
create index pas_identity_queue_idx on public.pas_identity_requests(status,created_at);
create index pas_identity_reviewer_idx on public.pas_identity_requests(reviewer_id);

create table public.pas_doctor_availability (
  doctor_id uuid primary key references public.doctor_profiles(id),
  is_available boolean not null default false,
  expires_at timestamptz not null default now(),
  capacity smallint not null default 1 check(capacity between 1 and 5),
  updated_at timestamptz not null default now()
);
create table public.pas_consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.doctor_profiles(id),
  relationship_id uuid references public.patient_doctor_relationships(id),
  visit_id uuid unique references public.visits(id),
  reason text not null check(length(btrim(reason)) between 5 and 2500),
  status text not null default 'requested'
    check(status in ('requested','accepted','completed','declined','cancelled')),
  consent_scopes text[] not null default '{}'
    check(consent_scopes <@ array['labs','medications','visits','follow_ups','diagnostics']::text[]),
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  check(patient_id<>doctor_id)
);
create unique index pas_consultation_one_open_idx on public.pas_consultations(patient_id,doctor_id)
where status in ('requested','accepted');
create index pas_consultation_doctor_idx on public.pas_consultations(doctor_id,status,requested_at);
create index pas_consultation_patient_idx on public.pas_consultations(patient_id,requested_at);
create index pas_consultation_relation_idx on public.pas_consultations(relationship_id);
create table public.pas_consultation_messages (
  id uuid primary key,
  consultation_id uuid not null references public.pas_consultations(id),
  sender_id uuid not null references public.profiles(id),
  body text check(length(body) between 1 and 4000),
  audio_path text unique,
  created_at timestamptz not null default now(),
  check((body is not null)::integer + (audio_path is not null)::integer = 1)
);
create index pas_messages_conversation_idx on public.pas_consultation_messages(consultation_id,created_at,id);
create index pas_messages_sender_idx on public.pas_consultation_messages(sender_id);
create table public.pas_visit_closures (
  visit_id uuid primary key references public.visits(id),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.doctor_profiles(id),
  summary text not null check(length(btrim(summary)) between 10 and 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pas_closure_patient_idx on public.pas_visit_closures(patient_id,created_at);
create index pas_closure_doctor_idx on public.pas_visit_closures(doctor_id);

create table public.pas_provider_services (
  provider_id uuid not null references public.laboratory_profiles(id),
  service_kind text not null check(service_kind in ('ct','mri','ecg','ultrasound','mammography','xray','other')),
  primary key(provider_id,service_kind)
);
create table public.pas_medical_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.doctor_profiles(id),
  provider_id uuid references public.laboratory_profiles(id),
  service_kind text not null check(service_kind in ('ct','mri','ecg','ultrasound','mammography','xray','other')),
  service_name text not null check(length(btrim(service_name)) between 2 and 200),
  clinical_note text check(length(clinical_note)<=2500),
  status text not null default 'requested'
    check(status in ('requested','accepted','in_progress','reported','cancelled')),
  scheduled_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create index pas_medical_patient_idx on public.pas_medical_requests(patient_id,requested_at);
create index pas_medical_doctor_idx on public.pas_medical_requests(doctor_id,requested_at);
create index pas_medical_provider_idx on public.pas_medical_requests(provider_id,status,requested_at);
create table public.pas_medical_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.pas_medical_requests(id),
  provider_id uuid not null references public.laboratory_profiles(id),
  conclusion text not null check(length(btrim(conclusion)) between 5 and 16000),
  measurements jsonb not null default '{}' check(jsonb_typeof(measurements)='object'),
  attachment_path text unique,
  supersedes_id uuid unique references public.pas_medical_results(id),
  created_at timestamptz not null default now()
);
create index pas_medical_results_request_idx on public.pas_medical_results(request_id,created_at);
create index pas_medical_results_provider_idx on public.pas_medical_results(provider_id);

alter table public.prescription_items
  add column quantity_units numeric(12,3) check(quantity_units>0 and quantity_units<=1000000),
  add column units_per_day numeric(10,3) check(units_per_day>0 and units_per_day<=1000),
  add column unit_label text not null default 'عدد' check(length(unit_label) between 1 and 30),
  add column as_needed boolean not null default false;
create table public.pas_medication_dispenses (
  id uuid primary key,
  prescription_item_id uuid not null references public.prescription_items(id),
  patient_id uuid not null references public.profiles(id),
  quantity_units numeric(12,3) not null check(quantity_units>0 and quantity_units<=1000000),
  received_at timestamptz not null check(received_at<=now()+interval '5 minutes'),
  source text not null check(source in ('patient','admin','provider')),
  recorded_by uuid not null references public.profiles(id),
  external_reference text check(length(external_reference)<=150),
  created_at timestamptz not null default now()
);
create index pas_dispense_item_idx on public.pas_medication_dispenses(prescription_item_id,received_at);
create index pas_dispense_patient_idx on public.pas_medication_dispenses(patient_id);
create index pas_dispense_actor_idx on public.pas_medication_dispenses(recorded_by);
create table public.pas_pharmacy_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  prescription_id uuid not null references public.prescriptions(id),
  delivery_address text not null check(length(btrim(delivery_address)) between 10 and 1200),
  contact_phone text not null check(contact_phone ~ '^989[0-9]{9}$'),
  status text not null default 'submitted'
    check(status in ('submitted','reviewing','preparing','dispatched','delivered','cancelled','rejected')),
  pharmacy_name text check(length(pharmacy_name)<=150),
  tracking_reference text check(length(tracking_reference)<=150),
  review_note text check(length(review_note)<=1000),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);
create unique index pas_pharmacy_one_open_idx on public.pas_pharmacy_requests(prescription_id)
where status in ('submitted','reviewing','preparing','dispatched');
create index pas_pharmacy_prescription_idx on public.pas_pharmacy_requests(prescription_id);
create index pas_pharmacy_patient_idx on public.pas_pharmacy_requests(patient_id,created_at);
create index pas_pharmacy_status_idx on public.pas_pharmacy_requests(status,created_at);

create table public.pas_integration_connections (
  provider_key text primary key check(provider_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  display_name text not null check(length(display_name) between 1 and 150),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.pas_integration_connections(provider_key,display_name)
values('tamin','تأمین اجتماعی'),('ihio','بیمه سلامت'),('diagnostic_center','مراکز تشخیصی');
create table public.pas_external_health_records (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.pas_integration_connections(provider_key),
  external_record_id text not null check(length(external_record_id) between 1 and 150),
  patient_id uuid not null references public.profiles(id),
  resource_kind text not null check(resource_kind in ('prescription','lab_result','imaging','ecg','visit','other')),
  title text not null check(length(title) between 1 and 200),
  summary text check(length(summary)<=16000),
  clinical_data jsonb not null default '{}' check(jsonb_typeof(clinical_data)='object'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique(provider_key,external_record_id)
);
create index pas_external_patient_idx on public.pas_external_health_records(patient_id,occurred_at);
create table public.pas_integration_events (
  provider_key text not null references public.pas_integration_connections(provider_key),
  event_id uuid not null,
  record_id uuid not null references public.pas_external_health_records(id),
  payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key(provider_key,event_id)
);
create index pas_integration_record_idx on public.pas_integration_events(record_id);

create function private.pas_role() returns text language sql stable security definer set search_path=''
as $$ select p.role::text from public.profiles p where p.id=(select auth.uid()) $$;
create function private.pas_can_read(p_patient uuid,p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select (p_patient=(select auth.uid()) and exists(select 1 from public.profiles where id=p_patient and role='patient')) or exists(
   select 1 from public.pas_record_access a
   join public.doctor_profiles d on d.id=a.doctor_id and d.is_verified
   join public.profiles p on p.id=d.id and p.role='doctor'
   where a.patient_id=p_patient and a.doctor_id=(select auth.uid())
   and p_scope=any(a.scopes) and (a.expires_at is null or a.expires_at>now())
   and exists(select 1 from public.patient_doctor_relationships r
     where r.patient_id=a.patient_id and r.doctor_id=a.doctor_id and r.status='active')
 )
$$;
create function private.pas_in_consultation(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pas_consultations c where c.id=p_id
 and (c.patient_id=(select auth.uid()) or
 (c.doctor_id=(select auth.uid()) and exists(select 1 from public.doctor_profiles d join public.profiles p on p.id=d.id where d.id=c.doctor_id and d.is_verified and p.role='doctor') and
   (c.status='requested' or private.pas_can_read(c.patient_id,'visits')))))
$$;
create function private.pas_valid_national_id(p_id text) returns boolean
language plpgsql immutable set search_path='' as $$
declare s integer:=0; i integer; r integer;
begin
 if p_id is null or p_id !~ '^[0-9]{10}$' or p_id ~ '^([0-9])\1{9}$' then return false; end if;
 for i in 1..9 loop s:=s+substring(p_id,i,1)::integer*(11-i); end loop;
 r:=s%11;
 return substring(p_id,10,1)::integer=case when r<2 then r else 11-r end;
end $$;

create function private.pas_care_command(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
create function public.pas_care_command(p_action text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select private.pas_care_command(p_action,p_payload)
$$;

create function private.pas_doctor_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q) order by q.available desc,q.own_doctor desc,q.full_name),'[]')
 from(
  select d.id as doctor_id,p.full_name,p.avatar_url,d.specialty,
   coalesce(a.is_available and a.expires_at>now() and
    (select count(*) from public.pas_consultations c where c.doctor_id=d.id and c.status='accepted')<a.capacity,false) as available,
   a.expires_at,
   exists(select 1 from public.patient_doctor_relationships r where r.patient_id=auth.uid() and r.doctor_id=d.id and r.status='active') as own_doctor
  from public.doctor_profiles d join public.profiles p on p.id=d.id and p.role='doctor'
  left join public.pas_doctor_availability a on a.doctor_id=d.id
  where auth.uid() is not null and private.pas_role()='patient' and d.is_verified and
   ((a.is_available and a.expires_at>now()) or exists(select 1 from public.patient_doctor_relationships r
      where r.patient_id=auth.uid() and r.doctor_id=d.id and r.status='active'))
  order by p.full_name limit 100
 ) q
$$;
create function public.pas_doctor_directory() returns jsonb language sql security invoker set search_path='' as $$
 select private.pas_doctor_directory()
$$;
create function private.pas_my_consultations() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q) order by q.requested_at desc),'[]') from(
 select c.*,p.full_name as patient_name,d.full_name as doctor_name,dp.specialty
 from public.pas_consultations c join public.profiles p on p.id=c.patient_id
 join public.profiles d on d.id=c.doctor_id join public.doctor_profiles dp on dp.id=d.id
 where private.pas_in_consultation(c.id) order by c.requested_at desc limit 100
 ) q
$$;
create function public.pas_my_consultations() returns jsonb language sql security invoker set search_path='' as $$
 select private.pas_my_consultations()
$$;
create function private.pas_service_providers() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(
 select l.id as provider_id,p.full_name,coalesce(o.name,p.full_name) as display_name,array_agg(s.service_kind order by s.service_kind) as services
 from public.laboratory_profiles l join public.profiles p on p.id=l.id and p.role='laboratory'
 join public.pas_provider_services s on s.provider_id=l.id
 left join public.organizations o on o.id=l.organization_id where auth.uid() is not null
 group by l.id,p.full_name,o.name order by coalesce(o.name,p.full_name) limit 200
 )q
$$;
create function public.pas_service_providers() returns jsonb language sql security invoker set search_path='' as $$
 select private.pas_service_providers()
$$;

create function private.pas_sync_visit_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' and old.status is distinct from 'completed' then
  update public.pas_consultations set status='completed',completed_at=now()
   where visit_id=new.id and status='accepted';
 end if;
 return new;
end $$;
create trigger pas_visit_completion after update of status on public.visits
for each row execute function private.pas_sync_visit_completion();

create function private.pas_finish_identity_request(p_request_id uuid,p_reviewer_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.pas_identity_requests%rowtype; auth_phone text;
begin
 if not public.is_service_role() then raise exception 'Server service access required' using errcode='42501'; end if;
 select * into r from public.pas_identity_requests where id=p_request_id for update;
 if not found then raise exception 'Identity request not found'; end if;
 if r.status='approved' then return jsonb_build_object('id',r.id); end if;
 if r.status<>'processing' or r.reviewer_id is distinct from p_reviewer_id or not exists(
  select 1 from public.profiles p join public.admin_profiles a on a.id=p.id where p.id=p_reviewer_id and p.role='admin'
 ) then raise exception 'Identity review is not authorized'; end if;
 if r.requested_phone is not null then
  select regexp_replace(phone,'^\+','') into auth_phone from auth.users
   where id=r.profile_id and phone_confirmed_at is not null;
  if auth_phone is distinct from r.requested_phone then raise exception 'Auth phone must be confirmed and synchronized first'; end if;
 end if;
 update public.profiles set phone=coalesce(r.requested_phone,phone),
  national_id=coalesce(r.requested_national_id,national_id) where id=r.profile_id;
 update public.pas_identity_requests set status='approved',reviewed_at=now() where id=r.id;
 return jsonb_build_object('id',r.id);
end $$;

create function public.pas_finish_identity_request(p_request_id uuid,p_reviewer_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select private.pas_finish_identity_request(p_request_id,p_reviewer_id)
$$;

alter table public.pas_external_health_records add column source_version bigint not null default 1 check(source_version>0),
 add column payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$');
create table public.pas_external_record_versions (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null references public.pas_external_health_records(id),
 source_version bigint not null,
 payload_snapshot jsonb not null,
 received_at timestamptz not null default now(),
 unique(record_id,source_version)
);
alter table public.pas_external_record_versions enable row level security;
revoke all on public.pas_external_record_versions from public,anon,authenticated;
grant select on public.pas_external_record_versions to authenticated;
grant all on public.pas_external_record_versions to service_role;
create policy pas_external_version_read on public.pas_external_record_versions for select to authenticated
using(exists(select 1 from public.pas_external_health_records r where r.id=record_id));

create function private.pas_ingest_external_event(p_provider text,p_event jsonb,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; record_uuid uuid; previous public.pas_external_health_records%rowtype;
 event_uuid uuid; revision bigint; existing_hash text;
begin
 if not public.is_service_role() then raise exception 'Server service access required' using errcode='42501'; end if;
 if jsonb_typeof(p_event) is distinct from 'object' or length(p_event::text)>262144 or p_hash !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid normalized event';
 end if;
 if not exists(select 1 from public.pas_integration_connections where provider_key=p_provider and enabled) then
  raise exception 'Integration is not enabled';
 end if;
 event_uuid:=(p_event->>'event_id')::uuid;
 revision:=(p_event->>'version')::bigint;
 if event_uuid is null or revision is null or revision<1 then raise exception 'Event identity and version required'; end if;
 -- Serialize by provider + record, including events that arrive concurrently.
 perform pg_advisory_xact_lock(hashtextextended(p_provider||':'||(p_event->>'external_record_id'),0));
 select payload_hash,record_id into existing_hash,record_uuid from public.pas_integration_events
  where provider_key=p_provider and event_id=event_uuid;
 if found then
  if existing_hash<>p_hash then raise exception 'Event id was reused with a different payload'; end if;
  return jsonb_build_object('record_id',record_uuid,'duplicate',true);
 end if;
 select id into u from public.profiles where role='patient' and national_id=p_event->>'patient_national_id';
 if u is null then raise exception 'Patient identity is not mapped'; end if;
 select * into previous from public.pas_external_health_records where provider_key=p_provider and external_record_id=p_event->>'external_record_id' for update;
 if found then
  record_uuid:=previous.id;
  if previous.patient_id<>u or previous.resource_kind<>p_event->>'resource_kind' then raise exception 'Record identity cannot change'; end if;
  if previous.source_version=revision and previous.payload_hash<>p_hash then raise exception 'Conflicting source version'; end if;
  if revision>previous.source_version then
   update public.pas_external_health_records set title=p_event->>'title',summary=p_event->>'summary',
    clinical_data=coalesce(p_event->'clinical_data','{}'),occurred_at=(p_event->>'occurred_at')::timestamptz,
    received_at=now(),source_version=revision,payload_hash=p_hash where id=record_uuid;
  end if;
 else
  insert into public.pas_external_health_records(provider_key,external_record_id,patient_id,resource_kind,title,
   summary,clinical_data,occurred_at,source_version,payload_hash)
  values(p_provider,p_event->>'external_record_id',u,p_event->>'resource_kind',p_event->>'title',
   p_event->>'summary',coalesce(p_event->'clinical_data','{}'),(p_event->>'occurred_at')::timestamptz,revision,p_hash)
  returning id into record_uuid;
 end if;
 insert into public.pas_external_record_versions(record_id,source_version,payload_snapshot)
 values(record_uuid,revision,p_event) on conflict do nothing;
 insert into public.pas_integration_events(provider_key,event_id,record_id,payload_hash)
 values(p_provider,event_uuid,record_uuid,p_hash);
 return jsonb_build_object('record_id',record_uuid,'duplicate',false);
end $$;

create function public.pas_ingest_external_event(p_provider text,p_event jsonb,p_hash text) returns jsonb
language sql security invoker set search_path='' as $$
 select private.pas_ingest_external_event(p_provider,p_event,p_hash)
$$;
revoke all on function private.pas_ingest_external_event(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.pas_ingest_external_event(text,jsonb,text) to service_role;

-- Private storage: only a consultation participant or the assigned service
-- provider can upload. No public bucket or unrestricted download is introduced.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pas-consultations','pas-consultations',false,2097152,
 array['audio/webm','audio/ogg','audio/mp4','audio/mpeg']),
 ('pas-medical-documents','pas-medical-documents',false,20971520,
 array['application/pdf','image/png','image/jpeg'])
on conflict(id) do nothing;
create policy pas_consultation_audio_upload on storage.objects for insert to authenticated
with check(bucket_id='pas-consultations'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.pas_consultations c where c.id::text=(storage.foldername(name))[1]
  and c.status='accepted' and private.pas_in_consultation(c.id)));
create policy pas_consultation_audio_read on storage.objects for select to authenticated
using(bucket_id='pas-consultations' and (
 ((storage.foldername(name))[2]=(select auth.uid())::text and exists(select 1 from public.pas_consultations c where c.id::text=(storage.foldername(name))[1] and c.status='accepted' and private.pas_in_consultation(c.id)))
 or exists(select 1 from public.pas_consultation_messages m
 where m.audio_path=name and private.pas_in_consultation(m.consultation_id))));
create policy pas_medical_document_upload on storage.objects for insert to authenticated
with check(bucket_id='pas-medical-documents'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.pas_medical_requests r where r.id::text=(storage.foldername(name))[1]
  and r.provider_id=(select auth.uid()) and r.status in ('accepted','in_progress','reported')));
create policy pas_medical_document_read on storage.objects for select to authenticated
using(bucket_id='pas-medical-documents' and (
 ((storage.foldername(name))[2]=(select auth.uid())::text and exists(select 1 from public.pas_medical_requests r where r.id::text=(storage.foldername(name))[1] and r.provider_id=(select auth.uid()) and r.status in ('accepted','in_progress','reported')))
 or exists(select 1 from public.pas_medical_results x
 join public.pas_medical_requests r on r.id=x.request_id where x.attachment_path=name
 and (r.provider_id=(select auth.uid()) or private.pas_can_read(r.patient_id,'diagnostics')))));

-- All writes below use narrow commands. Ordinary API clients can only SELECT.
do $$
declare t text;
begin
 foreach t in array array['pas_record_access','pas_identity_requests','pas_doctor_availability',
 'pas_consultations','pas_consultation_messages','pas_visit_closures','pas_provider_services',
 'pas_medical_requests','pas_medical_results','pas_medication_dispenses','pas_pharmacy_requests',
 'pas_integration_connections','pas_external_health_records','pas_integration_events']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy pas_access_read on public.pas_record_access for select to authenticated
using(patient_id=(select auth.uid()) or doctor_id=(select auth.uid()));
create policy pas_identity_read on public.pas_identity_requests for select to authenticated
using(profile_id=(select auth.uid()) or private.pas_role()='admin');
create policy pas_availability_read on public.pas_doctor_availability for select to authenticated
using(doctor_id=(select auth.uid()));
create policy pas_consultation_read on public.pas_consultations for select to authenticated
using(private.pas_in_consultation(id));
create policy pas_message_read on public.pas_consultation_messages for select to authenticated
using(private.pas_in_consultation(consultation_id));
create policy pas_closure_read on public.pas_visit_closures for select to authenticated
using(patient_id=(select auth.uid()) or (doctor_id=(select auth.uid()) and private.pas_can_read(patient_id,'visits')));
create policy pas_provider_read on public.pas_provider_services for select to authenticated using(true);
create policy pas_medical_read on public.pas_medical_requests for select to authenticated
using(patient_id=(select auth.uid()) or provider_id=(select auth.uid()) or private.pas_can_read(patient_id,'diagnostics'));
create policy pas_medical_result_read on public.pas_medical_results for select to authenticated
using(exists(select 1 from public.pas_medical_requests r where r.id=request_id
 and (r.provider_id=(select auth.uid()) or r.patient_id=(select auth.uid()) or private.pas_can_read(r.patient_id,'diagnostics'))));
create policy pas_dispense_read on public.pas_medication_dispenses for select to authenticated
using(patient_id=(select auth.uid()) or private.pas_can_read(patient_id,'medications'));
create policy pas_pharmacy_read on public.pas_pharmacy_requests for select to authenticated
using(patient_id=(select auth.uid()) or private.pas_role()='admin');
create policy pas_connection_read on public.pas_integration_connections for select to authenticated
using(private.pas_role()='admin');
create policy pas_external_read on public.pas_external_health_records for select to authenticated
using(private.pas_can_read(patient_id,case resource_kind when 'prescription' then 'medications'
 when 'lab_result' then 'labs' when 'visit' then 'visits' else 'diagnostics' end));
create policy pas_integration_event_read on public.pas_integration_events for select to authenticated
using(private.pas_role()='admin');

-- Add restrictive section gates, and permit an authorized doctor to see the
-- patient's earlier records from other doctors without exposing private notes.
create policy pas_lab_scope on public.lab_orders as restrictive for select to authenticated
using(private.pas_role() is distinct from 'doctor' or private.pas_can_read(patient_id,'labs'));
create policy pas_lab_history on public.lab_orders for select to authenticated
using(private.pas_role()='doctor' and private.pas_can_read(patient_id,'labs'));
create policy pas_rx_scope on public.prescriptions as restrictive for select to authenticated
using(private.pas_role() is distinct from 'doctor' or private.pas_can_read(patient_id,'medications'));
create policy pas_rx_history on public.prescriptions for select to authenticated
using(private.pas_role()='doctor' and private.pas_can_read(patient_id,'medications'));
create policy pas_rx_items_history on public.prescription_items for select to authenticated
using(exists(select 1 from public.prescriptions p where p.id=prescription_id
 and private.pas_role()='doctor' and private.pas_can_read(p.patient_id,'medications')));
create policy pas_visit_scope on public.visits as restrictive for select to authenticated
using(private.pas_role() is distinct from 'doctor' or private.pas_can_read(patient_id,'visits'));
create policy pas_visit_history on public.visits for select to authenticated
using(private.pas_role()='doctor' and private.pas_can_read(patient_id,'visits'));
create policy pas_followup_scope on public.follow_ups as restrictive for select to authenticated
using(private.pas_role() is distinct from 'doctor' or private.pas_can_read(patient_id,'follow_ups'));
create policy pas_followup_history on public.follow_ups for select to authenticated
using(private.pas_role()='doctor' and private.pas_can_read(patient_id,'follow_ups'));
create policy pas_report_history on public.diagnostic_reports for select to authenticated
using(status in ('final','amended') and exists(select 1 from public.lab_orders o
 where o.id=lab_order_id and private.pas_role()='doctor' and private.pas_can_read(o.patient_id,'labs')));
create policy pas_observation_history on public.observations for select to authenticated
using(status in ('final','corrected') and exists(select 1 from public.diagnostic_reports d
 join public.lab_orders o on o.id=d.lab_order_id where d.id=diagnostic_report_id
 and d.status in ('final','amended') and private.pas_role()='doctor' and private.pas_can_read(o.patient_id,'labs')));
create policy pas_voice_scope on public.voice_notes as restrictive for select to authenticated
using(private.pas_role() is distinct from 'doctor' or private.pas_can_read(patient_id,'visits'));

create function private.pas_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb:=to_jsonb(new); entity uuid;
begin
 entity:=coalesce(nullif(r->>'id','')::uuid,nullif(r->>'visit_id','')::uuid,nullif(r->>'patient_id','')::uuid);
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'pas.'||lower(tg_op),tg_table_name,entity,
 jsonb_build_object('changed_columns',(select jsonb_agg(k) from jsonb_object_keys(r) k)));
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['pas_record_access','pas_identity_requests','pas_consultations',
 'pas_visit_closures','pas_medical_requests','pas_medical_results','pas_medication_dispenses','pas_pharmacy_requests']
 loop execute format('create trigger pas_audit after insert or update on public.%I for each row execute function private.pas_audit_change()',t); end loop;
end $$;

-- Explicit execution privileges: trigger routines are never callable API entry points.
revoke all on function private.pas_role() from public,anon;
revoke all on function private.pas_can_read(uuid,text) from public,anon;
revoke all on function private.pas_in_consultation(uuid) from public,anon;
revoke all on function private.pas_valid_national_id(text) from public,anon,authenticated;
revoke all on function private.pas_audit_change() from public,anon,authenticated;
revoke all on function private.pas_sync_visit_completion() from public,anon,authenticated;
revoke all on function private.pas_care_command(text,jsonb) from public,anon;
revoke all on function private.pas_doctor_directory() from public,anon;
revoke all on function private.pas_my_consultations() from public,anon;
revoke all on function private.pas_service_providers() from public,anon;
revoke all on function public.pas_care_command(text,jsonb) from public,anon;
revoke all on function public.pas_doctor_directory() from public,anon;
revoke all on function public.pas_my_consultations() from public,anon;
revoke all on function public.pas_service_providers() from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.pas_role(),private.pas_can_read(uuid,text),private.pas_in_consultation(uuid),
 private.pas_care_command(text,jsonb),private.pas_doctor_directory(),private.pas_my_consultations(),
 private.pas_service_providers() to authenticated;
grant execute on function public.pas_care_command(text,jsonb),public.pas_doctor_directory(),
 public.pas_my_consultations(),public.pas_service_providers() to authenticated;
revoke all on function public.pas_finish_identity_request(uuid,uuid) from public,anon,authenticated;
revoke all on function private.pas_finish_identity_request(uuid,uuid) from public,anon,authenticated;
revoke all on function public.pas_ingest_external_event(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.pas_finish_identity_request(uuid,uuid),public.pas_ingest_external_event(text,jsonb,text) to service_role;
grant execute on function private.pas_finish_identity_request(uuid,uuid) to service_role;

create function public.pas_care_progress(p_patient uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (p_patient=auth.uid() or
  private.pas_can_read(p_patient,'labs') or private.pas_can_read(p_patient,'visits') or
  private.pas_can_read(p_patient,'follow_ups') or private.pas_can_read(p_patient,'diagnostics')) then
  raise exception 'Patient access required' using errcode='42501';
 end if;
 with work as(
  select 'labs' as kind,status='completed' as done from public.lab_orders
   where patient_id=p_patient and status<>'cancelled' and ordered_at<=now()
   and (status<>'completed' or completed_at>=now()-interval '90 days')
  union all select 'visits',status='completed' from public.visits
   where patient_id=p_patient and status<>'cancelled' and visit_date<=now()
   and (status<>'completed' or visit_date>=now()-interval '90 days')
  union all select 'follow_ups',status='completed' from public.follow_ups
   where patient_id=p_patient and status<>'cancelled'
   and (due_date<=(now() at time zone 'Asia/Tehran')::date or status='completed')
   and (status<>'completed' or completed_at>=now()-interval '90 days')
  union all select 'diagnostics',status='reported' from public.pas_medical_requests
   where patient_id=p_patient and status<>'cancelled' and requested_at<=now()
   and (status<>'reported' or completed_at>=now()-interval '90 days')
 ), counts as(select kind,count(*) as total,count(*) filter(where done) as completed from work group by kind)
 select jsonb_build_object('total',coalesce(sum(total),0),'completed',coalesce(sum(completed),0),
 'sections',coalesce(jsonb_agg(to_jsonb(counts)),'[]')) into result from counts;
 return result;
end $$;
revoke all on function public.pas_care_progress(uuid) from public,anon;
grant execute on function public.pas_care_progress(uuid) to authenticated;


-- Preserve the existing atomic prescription contract and accept optional structured quantities.
CREATE OR REPLACE FUNCTION public.create_prescription_with_items(p_patient_id uuid, p_diagnostic_report_id uuid, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prescription_id uuid;
  v_item jsonb;
  v_count integer;
  v_medication_name text;
  v_dosage text;
  v_frequency text;
  v_duration text;
  v_instructions text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.doctor_profiles dp ON dp.id = p.id
    WHERE p.id = v_uid
      AND p.role = 'doctor'::public.user_role
      AND dp.is_verified = true
  ) THEN
    RAISE EXCEPTION 'Verified doctor required';
  END IF;

  IF p_patient_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patient_profiles pp WHERE pp.id = p_patient_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.patient_doctor_relationships pdr
    WHERE pdr.patient_id = p_patient_id
      AND pdr.doctor_id = v_uid
      AND pdr.status = 'active'::public.relationship_status
  ) THEN
    RAISE EXCEPTION 'Active patient-doctor relationship required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Prescription items must be an array';
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(p_items);
  IF v_count < 1 OR v_count > 20 THEN
    RAISE EXCEPTION 'Prescription must contain 1 to 20 items';
  END IF;

  IF p_diagnostic_report_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.diagnostic_reports dr
    JOIN public.lab_orders lo ON lo.id = dr.lab_order_id
    WHERE dr.id = p_diagnostic_report_id
      AND dr.status IN ('final'::public.report_status, 'amended'::public.report_status)
      AND lo.patient_id = p_patient_id
      AND lo.doctor_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Diagnostic report does not belong to this patient and doctor or is not finalized';
  END IF;

  -- Validate every item before inserting either the parent or its children.
  FOR v_item IN SELECT elem.value FROM jsonb_array_elements(p_items) elem
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Each prescription item must be an object';
    END IF;
    IF jsonb_typeof(v_item -> 'medication_name') IS DISTINCT FROM 'string'
       OR length(btrim(coalesce(v_item ->> 'medication_name', ''))) NOT BETWEEN 1 AND 150
       OR jsonb_typeof(v_item -> 'dosage') IS DISTINCT FROM 'string'
       OR length(btrim(coalesce(v_item ->> 'dosage', ''))) NOT BETWEEN 1 AND 100
       OR jsonb_typeof(v_item -> 'frequency') IS DISTINCT FROM 'string'
       OR length(btrim(coalesce(v_item ->> 'frequency', ''))) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Medication name, dosage and frequency are required and must fit their field limits';
    END IF;
    IF coalesce(jsonb_typeof(v_item -> 'duration'), 'null') NOT IN ('null', 'string')
       OR length(btrim(coalesce(v_item ->> 'duration', ''))) > 100
       OR coalesce(jsonb_typeof(v_item -> 'instructions'), 'null') NOT IN ('null', 'string')
       OR length(btrim(coalesce(v_item ->> 'instructions', ''))) > 1000 THEN
      RAISE EXCEPTION 'Duration or instructions are invalid';
    END IF;
  END LOOP;

  INSERT INTO public.prescriptions (
    patient_id, doctor_id, diagnostic_report_id, status
  ) VALUES (
    p_patient_id, v_uid, p_diagnostic_report_id, 'active'::public.prescription_status
  ) RETURNING id INTO v_prescription_id;

  FOR v_item IN SELECT elem.value FROM jsonb_array_elements(p_items) elem
  LOOP
    v_medication_name := btrim(v_item ->> 'medication_name');
    v_dosage := btrim(v_item ->> 'dosage');
    v_frequency := btrim(v_item ->> 'frequency');
    v_duration := nullif(btrim(coalesce(v_item ->> 'duration', '')), '');
    v_instructions := nullif(btrim(coalesce(v_item ->> 'instructions', '')), '');

    INSERT INTO public.prescription_items (
      prescription_id, medication_name, dosage, frequency, duration, instructions,
      quantity_units, units_per_day, unit_label, as_needed
    ) VALUES (
      v_prescription_id, v_medication_name, v_dosage, v_frequency, v_duration, v_instructions,
      nullif(v_item->>'quantity_units','')::numeric, nullif(v_item->>'units_per_day','')::numeric,
      coalesce(nullif(v_item->>'unit_label',''),'عدد'), coalesce((v_item->>'as_needed')::boolean,false)
    );
  END LOOP;

  RETURN v_prescription_id;
END;
$function$
;

-- Legacy approvals retain their previously documented broad consent. New
-- approval commands replace this row with the patient's exact scope selection
-- in the same transaction; online requests already have an explicit grant.
create function private.pas_seed_legacy_approval() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='pending' and new.status='active' then
  insert into public.pas_record_access(patient_id,doctor_id,scopes)
  values(new.patient_id,new.doctor_id,array['labs','medications','visits','follow_ups','diagnostics']) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.pas_seed_legacy_approval() from public,anon,authenticated;
create trigger pas_legacy_approval after update of status on public.patient_doctor_relationships
for each row execute function private.pas_seed_legacy_approval();
