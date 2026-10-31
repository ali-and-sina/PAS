set check_function_bodies=off;

create role anon nologin;

create role authenticated nologin;

create role service_role nologin bypassrls;

create role authenticator nologin;

grant anon,authenticated,service_role to authenticator;

create schema auth;

create schema private;

create schema storage;

grant usage on schema public,auth,private,storage to anon,authenticated,service_role;

revoke create on schema public from public;

-- Captured application-owner table defaults before the hardening migrations.
alter default privileges for role postgres in schema public
grant truncate, references, trigger, maintain on tables to anon, authenticated, service_role;

create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}'::jsonb);

create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb, owner_id text);

alter table storage.objects enable row level security;

grant select,insert,update,delete on storage.objects to anon,authenticated;

create function public.uuid_generate_v4() returns uuid language sql as $$select gen_random_uuid()$$;

CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$;

CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$;

CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;

create type public."user_role" as enum ('patient','doctor','laboratory','admin');

create type public."relationship_status" as enum ('active','inactive','pending');

create type public."relationship_type" as enum ('primary_care','consulting','one_time');

create type public."order_status" as enum ('pending','received_by_lab','in_progress','completed','cancelled');

create type public."report_status" as enum ('draft','final','amended');

create type public."observation_status" as enum ('preliminary','final','corrected','superseded');

create type public."flag_status" as enum ('normal','low','high','critical_low','critical_high','unknown');

create type public."prescription_status" as enum ('active','completed','cancelled');

create type public."ai_review_status" as enum ('pending','approved','edited','rejected');

create table public."guest_result_accesses"("id" uuid default uuid_generate_v4() not null,"diagnostic_report_id" uuid not null,"token_hash" text not null,"expires_at" timestamp with time zone not null,"revoked_at" timestamp with time zone,"created_by" uuid not null,"access_count" integer default 0 not null,"last_accessed_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null);

create table public."profiles"("id" uuid not null,"role" user_role not null,"full_name" text not null,"phone" text,"national_id" text,"avatar_url" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);

create table public."doctor_profiles"("id" uuid not null,"medical_license_number" text not null,"specialty" text,"is_verified" boolean default false not null,"verified_at" timestamp with time zone,"verified_by" uuid,"created_at" timestamp with time zone default now() not null);

create table public."patient_profiles"("id" uuid not null,"date_of_birth" date not null,"sex" text not null,"blood_type" text,"emergency_contact_name" text,"emergency_contact_phone" text,"created_at" timestamp with time zone default now() not null);

create table public."organizations"("id" uuid default uuid_generate_v4() not null,"name" text not null,"type" text not null,"license_number" text,"address" text,"created_at" timestamp with time zone default now() not null);

create table public."organization_members"("id" uuid default uuid_generate_v4() not null,"organization_id" uuid not null,"profile_id" uuid not null,"role_in_org" text default 'member'::text not null,"created_at" timestamp with time zone default now() not null);

create table public."laboratory_profiles"("id" uuid not null,"organization_id" uuid,"license_number" text not null,"created_at" timestamp with time zone default now() not null);

create table public."patient_doctor_relationships"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"relationship_type" relationship_type default 'primary_care'::relationship_type not null,"status" relationship_status default 'active'::relationship_status not null,"started_at" timestamp with time zone default now() not null,"ended_at" timestamp with time zone,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null);

create table public."test_definitions"("id" uuid default uuid_generate_v4() not null,"internal_code" text not null,"name" text not null,"name_fa" text,"category" text not null,"default_unit" text not null,"value_type" text default 'numeric'::text not null,"loinc_code" text,"decimal_precision" integer default 1,"is_active" boolean default true not null,"created_at" timestamp with time zone default now() not null,"allows_negative" boolean default false not null);

create table public."test_aliases"("id" uuid default uuid_generate_v4() not null,"test_definition_id" uuid not null,"alias" text not null,"source_lab_id" uuid);

create table public."test_panels"("id" uuid default uuid_generate_v4() not null,"code" text not null,"name" text not null,"name_fa" text,"is_active" boolean default true not null);

create table public."test_panel_items"("id" uuid default uuid_generate_v4() not null,"panel_id" uuid not null,"test_definition_id" uuid not null,"display_order" integer default 0 not null,"is_required" boolean default true not null);

create table public."reference_range_templates"("id" uuid default uuid_generate_v4() not null,"test_definition_id" uuid not null,"laboratory_id" uuid,"sex" text default 'any'::text,"min_age_years" numeric,"max_age_years" numeric,"min_value" numeric,"max_value" numeric,"unit" text not null,"method" text,"is_active" boolean default true not null,"created_at" timestamp with time zone default now() not null);

create table public."lab_orders"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"laboratory_id" uuid,"status" order_status default 'pending'::order_status not null,"clinical_note" text,"ordered_at" timestamp with time zone default now() not null,"received_at" timestamp with time zone,"completed_at" timestamp with time zone,"cancelled_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null,"physician_lab_request_id" uuid,"lab_dispatch_id" uuid,"laboratory_branch_id" uuid);

create table public."observations"("id" uuid default uuid_generate_v4() not null,"diagnostic_report_id" uuid not null,"test_definition_id" uuid not null,"value_numeric" numeric,"value_text" text,"value_boolean" boolean,"unit" text not null,"reference_range_template_id" uuid,"reference_min" numeric,"reference_max" numeric,"reference_text" text,"flag" flag_status default 'unknown'::flag_status not null,"status" observation_status default 'final'::observation_status not null,"supersedes_observation_id" uuid,"entered_by" uuid not null,"observed_at" timestamp with time zone default now() not null,"created_at" timestamp with time zone default now() not null,"reference_source" text);

create table public."doctor_interpretations"("id" uuid default uuid_generate_v4() not null,"diagnostic_report_id" uuid not null,"doctor_id" uuid not null,"content" text not null,"is_visible_to_patient" boolean default true not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);

create table public."diagnostic_reports"("id" uuid default uuid_generate_v4() not null,"lab_order_id" uuid not null,"laboratory_id" uuid not null,"status" report_status default 'draft'::report_status not null,"entered_by" uuid not null,"finalized_by" uuid,"finalized_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);

create table public."doctor_notes"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"diagnostic_report_id" uuid,"content" text not null,"created_at" timestamp with time zone default now() not null);

create table public."prescriptions"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"diagnostic_report_id" uuid,"status" prescription_status default 'active'::prescription_status not null,"issued_at" timestamp with time zone default now() not null,"created_at" timestamp with time zone default now() not null);

create table public."lab_dispatches"("id" uuid default gen_random_uuid() not null,"physician_lab_request_id" uuid not null,"laboratory_branch_id" uuid not null,"created_by" uuid not null,"status" text default 'pending'::text not null,"sent_at" timestamp with time zone default now() not null,"responded_at" timestamp with time zone,"responded_by" uuid,"response_note" text,"lab_order_id" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"requested_home_collection" boolean default false not null);

create table public."physician_lab_requests"("id" uuid default gen_random_uuid() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"created_by" uuid not null,"clinical_note" text,"requested_home_collection" boolean default false not null,"status" text default 'submitted'::text not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"cancelled_at" timestamp with time zone,"fulfilled_at" timestamp with time zone);

create table public."notifications"("id" uuid default uuid_generate_v4() not null,"recipient_id" uuid not null,"type" text not null,"title" text not null,"body" text,"related_entity_type" text,"related_entity_id" uuid,"is_read" boolean default false not null,"created_at" timestamp with time zone default now() not null,"status" text default 'unread'::text not null,"reviewed_at" timestamp with time zone,"reviewed_by" uuid);

create table public."prescription_items"("id" uuid default uuid_generate_v4() not null,"prescription_id" uuid not null,"medication_name" text not null,"dosage" text not null,"frequency" text not null,"duration" text,"instructions" text,"created_at" timestamp with time zone default now() not null);

create table public."ai_analyses"("id" uuid default uuid_generate_v4() not null,"diagnostic_report_id" uuid,"patient_id" uuid not null,"analysis_type" text not null,"model" text not null,"prompt_version" text not null,"input_snapshot" jsonb not null,"output" text not null,"review_status" ai_review_status default 'pending'::ai_review_status not null,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"final_edited_content" text,"is_visible_to_patient" boolean default false not null,"created_at" timestamp with time zone default now() not null);

create table public."trend_analyses"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"test_definition_id" uuid not null,"current_observation_id" uuid not null,"previous_observation_id" uuid,"direction" text,"percent_change" numeric,"calculated_at" timestamp with time zone default now() not null);

create table public."laboratory_branches"("id" uuid default gen_random_uuid() not null,"organization_id" uuid not null,"display_name" text not null,"city" text,"address" text,"latitude" numeric(9,6),"longitude" numeric(9,6),"is_active" boolean default true not null,"supports_home_collection" boolean default false not null,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);

create table public."laboratory_branch_members"("id" uuid default gen_random_uuid() not null,"branch_id" uuid not null,"profile_id" uuid not null,"role_in_branch" text default 'member'::text not null,"is_active" boolean default true not null,"granted_by" uuid,"created_at" timestamp with time zone default now() not null);

create table public."physician_lab_request_items"("id" uuid default gen_random_uuid() not null,"physician_lab_request_id" uuid not null,"test_panel_id" uuid,"test_definition_id" uuid,"created_at" timestamp with time zone default now() not null);

create table public."home_collection_requests"("id" uuid default gen_random_uuid() not null,"physician_lab_request_id" uuid not null,"lab_dispatch_id" uuid not null,"laboratory_branch_id" uuid not null,"lab_order_id" uuid,"patient_id" uuid not null,"doctor_id" uuid not null,"status" text default 'requested'::text not null,"requested_at" timestamp with time zone default now() not null,"approved_at" timestamp with time zone,"rejected_at" timestamp with time zone,"scheduled_for" timestamp with time zone,"collector_profile_id" uuid,"dispatched_at" timestamp with time zone,"collected_at" timestamp with time zone,"cancelled_at" timestamp with time zone,"rejection_reason" text,"collection_note" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);

create table public."home_collection_private_details"("home_collection_request_id" uuid not null,"patient_id" uuid not null,"city" text not null,"address" text not null,"address_line2" text,"postal_code" text,"latitude" numeric(9,6),"longitude" numeric(9,6),"contact_phone" text not null,"access_instructions" text,"preferred_window" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);

create table public."lab_order_items"("id" uuid default uuid_generate_v4() not null,"lab_order_id" uuid not null,"test_panel_id" uuid,"test_definition_id" uuid,"created_at" timestamp with time zone default now() not null);

create table public."attachments"("id" uuid default uuid_generate_v4() not null,"diagnostic_report_id" uuid,"uploaded_by" uuid not null,"storage_path" text not null,"file_name" text not null,"file_type" text not null,"file_size_bytes" bigint,"created_at" timestamp with time zone default now() not null);

create table public."audit_logs"("id" uuid default uuid_generate_v4() not null,"actor_id" uuid,"action" text not null,"entity_type" text not null,"entity_id" uuid not null,"metadata" jsonb,"ip_address" inet,"created_at" timestamp with time zone default now() not null);

create table public."lab_workflow_qr_tokens"("id" uuid default gen_random_uuid() not null,"target_type" text not null,"dispatch_id" uuid,"home_collection_request_id" uuid,"token_hash" text not null,"created_by" uuid not null,"expires_at" timestamp with time zone not null,"revoked_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null);

create table public."lab_workflow_events"("id" uuid default gen_random_uuid() not null,"actor_id" uuid,"event_type" text not null,"entity_type" text not null,"entity_id" uuid not null,"patient_id" uuid,"doctor_id" uuid,"laboratory_branch_id" uuid,"physician_lab_request_id" uuid,"lab_dispatch_id" uuid,"lab_order_id" uuid,"home_collection_request_id" uuid,"metadata" jsonb default '{}'::jsonb not null,"created_at" timestamp with time zone default now() not null);

create table public."consents"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"consent_type" text not null,"granted" boolean not null,"granted_at" timestamp with time zone default now() not null,"revoked_at" timestamp with time zone);

create table public."admin_profiles"("id" uuid not null,"personnel_code" text not null,"created_at" timestamp with time zone default now() not null);

create table public."follow_ups"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"title" text not null,"description" text,"due_date" date not null,"status" text default 'pending'::text not null,"created_at" timestamp with time zone default now() not null,"completed_at" timestamp with time zone,"cancelled_at" timestamp with time zone);

create table public."voice_notes"("id" uuid default uuid_generate_v4() not null,"visit_id" uuid not null,"patient_id" uuid not null,"doctor_id" uuid not null,"audio_path" text not null,"duration" numeric(10,2),"created_at" timestamp with time zone default now() not null,"archived_at" timestamp with time zone);

create table public."visits"("id" uuid default uuid_generate_v4() not null,"patient_id" uuid not null,"doctor_id" uuid not null,"visit_date" timestamp with time zone default now() not null,"status" text default 'scheduled'::text not null,"created_at" timestamp with time zone default now() not null);

create table public."transcripts"("id" uuid default uuid_generate_v4() not null,"voice_note_id" uuid not null,"transcript_text" text not null,"created_at" timestamp with time zone default now() not null);

create table public."visit_summaries"("id" uuid default uuid_generate_v4() not null,"voice_note_id" uuid not null,"summary" text not null,"doctor_confirmed" boolean default false not null,"confirmed_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"structured_content" jsonb default '{}'::jsonb not null);

alter table public."guest_result_accesses" add constraint "guest_result_accesses_access_count_nonnegative" CHECK ((access_count >= 0));

alter table public."guest_result_accesses" add constraint "guest_result_accesses_expiry_after_created" CHECK ((expires_at > created_at));

alter table public."guest_result_accesses" add constraint "guest_result_accesses_pkey" PRIMARY KEY (id);

alter table public."guest_result_accesses" add constraint "guest_result_accesses_token_hash_key" UNIQUE (token_hash);

alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table public."doctor_profiles" add constraint "doctor_profiles_medical_license_number_key" UNIQUE (medical_license_number);

alter table public."doctor_profiles" add constraint "doctor_profiles_pkey" PRIMARY KEY (id);

alter table public."patient_profiles" add constraint "patient_profiles_pkey" PRIMARY KEY (id);

alter table public."patient_profiles" add constraint "patient_profiles_sex_check" CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text])));

alter table public."organizations" add constraint "organizations_pkey" PRIMARY KEY (id);

alter table public."organizations" add constraint "organizations_type_check" CHECK ((type = ANY (ARRAY['laboratory'::text, 'clinic'::text, 'hospital'::text])));

alter table public."organization_members" add constraint "organization_members_organization_id_profile_id_key" UNIQUE (organization_id, profile_id);

alter table public."organization_members" add constraint "organization_members_pkey" PRIMARY KEY (id);

alter table public."laboratory_profiles" add constraint "laboratory_profiles_license_number_key" UNIQUE (license_number);

alter table public."laboratory_profiles" add constraint "laboratory_profiles_pkey" PRIMARY KEY (id);

alter table public."patient_doctor_relationships" add constraint "patient_doctor_relationships_pkey" PRIMARY KEY (id);

alter table public."test_definitions" add constraint "test_definitions_internal_code_key" UNIQUE (internal_code);

alter table public."test_definitions" add constraint "test_definitions_pkey" PRIMARY KEY (id);

alter table public."test_definitions" add constraint "test_definitions_value_type_check" CHECK ((value_type = ANY (ARRAY['numeric'::text, 'text'::text, 'boolean'::text])));

alter table public."test_aliases" add constraint "test_aliases_pkey" PRIMARY KEY (id);

alter table public."test_panels" add constraint "test_panels_code_key" UNIQUE (code);

alter table public."test_panels" add constraint "test_panels_pkey" PRIMARY KEY (id);

alter table public."test_panel_items" add constraint "test_panel_items_panel_id_test_definition_id_key" UNIQUE (panel_id, test_definition_id);

alter table public."test_panel_items" add constraint "test_panel_items_pkey" PRIMARY KEY (id);

alter table public."reference_range_templates" add constraint "reference_range_min_max_check" CHECK (((min_value IS NULL) OR (max_value IS NULL) OR (min_value <= max_value)));

alter table public."reference_range_templates" add constraint "reference_range_templates_pkey" PRIMARY KEY (id);

alter table public."reference_range_templates" add constraint "reference_range_templates_sex_check" CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text, 'any'::text])));

alter table public."lab_orders" add constraint "lab_orders_pkey" PRIMARY KEY (id);

alter table public."observations" add constraint "observations_check" CHECK ((((((value_numeric IS NOT NULL))::integer + ((value_text IS NOT NULL))::integer) + ((value_boolean IS NOT NULL))::integer) = 1));

alter table public."observations" add constraint "observations_pkey" PRIMARY KEY (id);

alter table public."observations" add constraint "observations_reference_source_check" CHECK (((reference_source IS NULL) OR (reference_source = ANY (ARRAY['generic'::text, 'laboratory'::text]))));

alter table public."doctor_interpretations" add constraint "doctor_interpretations_pkey" PRIMARY KEY (id);

alter table public."diagnostic_reports" add constraint "diagnostic_reports_pkey" PRIMARY KEY (id);

alter table public."doctor_notes" add constraint "doctor_notes_pkey" PRIMARY KEY (id);

alter table public."prescriptions" add constraint "prescriptions_pkey" PRIMARY KEY (id);

alter table public."lab_dispatches" add constraint "lab_dispatches_lab_order_id_key" UNIQUE (lab_order_id);

alter table public."lab_dispatches" add constraint "lab_dispatches_pkey" PRIMARY KEY (id);

alter table public."lab_dispatches" add constraint "lab_dispatches_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])));

alter table public."physician_lab_requests" add constraint "physician_lab_requests_pkey" PRIMARY KEY (id);

alter table public."physician_lab_requests" add constraint "physician_lab_requests_status_check" CHECK ((status = ANY (ARRAY['submitted'::text, 'fulfilled'::text, 'cancelled'::text])));

alter table public."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);

alter table public."notifications" add constraint "notifications_status_check" CHECK ((status = ANY (ARRAY['unread'::text, 'read'::text, 'reviewed'::text])));

alter table public."prescription_items" add constraint "prescription_items_pkey" PRIMARY KEY (id);

alter table public."ai_analyses" add constraint "ai_analyses_pkey" PRIMARY KEY (id);

alter table public."trend_analyses" add constraint "trend_analyses_direction_check" CHECK ((direction = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text, 'new'::text])));

alter table public."trend_analyses" add constraint "trend_analyses_pkey" PRIMARY KEY (id);

alter table public."laboratory_branches" add constraint "laboratory_branches_coordinates_pair" CHECK (((latitude IS NULL) = (longitude IS NULL)));

alter table public."laboratory_branches" add constraint "laboratory_branches_display_name_check" CHECK (((length(btrim(display_name)) >= 2) AND (length(btrim(display_name)) <= 160)));

alter table public."laboratory_branches" add constraint "laboratory_branches_latitude_range" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))));

alter table public."laboratory_branches" add constraint "laboratory_branches_longitude_range" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))));

alter table public."laboratory_branches" add constraint "laboratory_branches_pkey" PRIMARY KEY (id);

alter table public."laboratory_branch_members" add constraint "laboratory_branch_members_branch_id_profile_id_key" UNIQUE (branch_id, profile_id);

alter table public."laboratory_branch_members" add constraint "laboratory_branch_members_pkey" PRIMARY KEY (id);

alter table public."laboratory_branch_members" add constraint "laboratory_branch_members_role_in_branch_check" CHECK ((role_in_branch = ANY (ARRAY['manager'::text, 'member'::text, 'collector'::text])));

alter table public."physician_lab_request_items" add constraint "physician_lab_request_items_one_test_source" CHECK ((((test_panel_id IS NOT NULL) AND (test_definition_id IS NULL)) OR ((test_panel_id IS NULL) AND (test_definition_id IS NOT NULL))));

alter table public."physician_lab_request_items" add constraint "physician_lab_request_items_pkey" PRIMARY KEY (id);

alter table public."home_collection_requests" add constraint "home_collection_requests_lab_dispatch_id_key" UNIQUE (lab_dispatch_id);

alter table public."home_collection_requests" add constraint "home_collection_requests_pkey" PRIMARY KEY (id);

alter table public."home_collection_requests" add constraint "home_collection_requests_status_check" CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'scheduled'::text, 'dispatched'::text, 'collected'::text, 'cancelled'::text])));

alter table public."home_collection_private_details" add constraint "home_collection_details_coordinates_pair" CHECK (((latitude IS NULL) = (longitude IS NULL)));

alter table public."home_collection_private_details" add constraint "home_collection_details_latitude_range" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))));

alter table public."home_collection_private_details" add constraint "home_collection_details_longitude_range" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))));

alter table public."home_collection_private_details" add constraint "home_collection_private_details_address_check" CHECK (((length(btrim(address)) >= 5) AND (length(btrim(address)) <= 500)));

alter table public."home_collection_private_details" add constraint "home_collection_private_details_city_check" CHECK (((length(btrim(city)) >= 2) AND (length(btrim(city)) <= 120)));

alter table public."home_collection_private_details" add constraint "home_collection_private_details_pkey" PRIMARY KEY (home_collection_request_id);

alter table public."lab_order_items" add constraint "lab_order_items_check" CHECK ((((test_panel_id IS NOT NULL) AND (test_definition_id IS NULL)) OR ((test_panel_id IS NULL) AND (test_definition_id IS NOT NULL))));

alter table public."lab_order_items" add constraint "lab_order_items_pkey" PRIMARY KEY (id);

alter table public."attachments" add constraint "attachments_pkey" PRIMARY KEY (id);

alter table public."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY (id);

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_target_exactly_one" CHECK ((((target_type = 'dispatch'::text) AND (dispatch_id IS NOT NULL) AND (home_collection_request_id IS NULL)) OR ((target_type = 'home_collection'::text) AND (home_collection_request_id IS NOT NULL) AND (dispatch_id IS NULL))));

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_pkey" PRIMARY KEY (id);

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_target_type_check" CHECK ((target_type = ANY (ARRAY['dispatch'::text, 'home_collection'::text])));

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_token_hash_check" CHECK ((length(token_hash) = 64));

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_token_hash_key" UNIQUE (token_hash);

alter table public."lab_workflow_events" add constraint "lab_workflow_events_pkey" PRIMARY KEY (id);

alter table public."consents" add constraint "consents_pkey" PRIMARY KEY (id);

alter table public."admin_profiles" add constraint "admin_profiles_personnel_code_not_blank" CHECK ((personnel_code <> ''::text));

alter table public."admin_profiles" add constraint "admin_profiles_personnel_code_trimmed" CHECK ((personnel_code = btrim(personnel_code)));

alter table public."admin_profiles" add constraint "admin_profiles_pkey" PRIMARY KEY (id);

alter table public."follow_ups" add constraint "follow_ups_pkey" PRIMARY KEY (id);

alter table public."follow_ups" add constraint "follow_ups_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'overdue'::text, 'cancelled'::text])));

alter table public."voice_notes" add constraint "voice_notes_pkey" PRIMARY KEY (id);

alter table public."visits" add constraint "visits_pkey" PRIMARY KEY (id);

alter table public."visits" add constraint "visits_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));

alter table public."transcripts" add constraint "transcripts_pkey" PRIMARY KEY (id);

alter table public."transcripts" add constraint "transcripts_voice_note_id_key" UNIQUE (voice_note_id);

alter table public."visit_summaries" add constraint "visit_summaries_pkey" PRIMARY KEY (id);

alter table public."visit_summaries" add constraint "visit_summaries_structured_content_object_check" CHECK ((jsonb_typeof(structured_content) = 'object'::text));

alter table public."visit_summaries" add constraint "visit_summaries_voice_note_id_key" UNIQUE (voice_note_id);

alter table public."guest_result_accesses" add constraint "guest_result_accesses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table public."guest_result_accesses" add constraint "guest_result_accesses_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id) ON DELETE CASCADE;

alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."doctor_profiles" add constraint "doctor_profiles_id_fkey" FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."doctor_profiles" add constraint "doctor_profiles_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES profiles(id);

alter table public."patient_profiles" add constraint "patient_profiles_id_fkey" FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."organization_members" add constraint "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

alter table public."organization_members" add constraint "organization_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."laboratory_profiles" add constraint "laboratory_profiles_id_fkey" FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."laboratory_profiles" add constraint "laboratory_profiles_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);

alter table public."patient_doctor_relationships" add constraint "patient_doctor_relationships_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table public."patient_doctor_relationships" add constraint "patient_doctor_relationships_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE;

alter table public."patient_doctor_relationships" add constraint "patient_doctor_relationships_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE;

alter table public."test_aliases" add constraint "test_aliases_source_lab_id_fkey" FOREIGN KEY (source_lab_id) REFERENCES laboratory_profiles(id);

alter table public."test_aliases" add constraint "test_aliases_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id) ON DELETE CASCADE;

alter table public."test_panel_items" add constraint "test_panel_items_panel_id_fkey" FOREIGN KEY (panel_id) REFERENCES test_panels(id) ON DELETE CASCADE;

alter table public."test_panel_items" add constraint "test_panel_items_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id) ON DELETE CASCADE;

alter table public."reference_range_templates" add constraint "reference_range_templates_laboratory_id_fkey" FOREIGN KEY (laboratory_id) REFERENCES laboratory_profiles(id);

alter table public."reference_range_templates" add constraint "reference_range_templates_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id) ON DELETE CASCADE;

alter table public."lab_orders" add constraint "lab_orders_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."lab_orders" add constraint "lab_orders_lab_dispatch_id_fkey" FOREIGN KEY (lab_dispatch_id) REFERENCES lab_dispatches(id) ON DELETE SET NULL;

alter table public."lab_orders" add constraint "lab_orders_laboratory_branch_id_fkey" FOREIGN KEY (laboratory_branch_id) REFERENCES laboratory_branches(id) ON DELETE RESTRICT;

alter table public."lab_orders" add constraint "lab_orders_laboratory_id_fkey" FOREIGN KEY (laboratory_id) REFERENCES laboratory_profiles(id);

alter table public."lab_orders" add constraint "lab_orders_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."lab_orders" add constraint "lab_orders_physician_lab_request_id_fkey" FOREIGN KEY (physician_lab_request_id) REFERENCES physician_lab_requests(id) ON DELETE SET NULL;

alter table public."observations" add constraint "observations_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id) ON DELETE CASCADE;

alter table public."observations" add constraint "observations_entered_by_fkey" FOREIGN KEY (entered_by) REFERENCES profiles(id);

alter table public."observations" add constraint "observations_reference_range_template_id_fkey" FOREIGN KEY (reference_range_template_id) REFERENCES reference_range_templates(id);

alter table public."observations" add constraint "observations_supersedes_observation_id_fkey" FOREIGN KEY (supersedes_observation_id) REFERENCES observations(id);

alter table public."observations" add constraint "observations_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id);

alter table public."doctor_interpretations" add constraint "doctor_interpretations_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id);

alter table public."doctor_interpretations" add constraint "doctor_interpretations_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."diagnostic_reports" add constraint "diagnostic_reports_entered_by_fkey" FOREIGN KEY (entered_by) REFERENCES profiles(id);

alter table public."diagnostic_reports" add constraint "diagnostic_reports_finalized_by_fkey" FOREIGN KEY (finalized_by) REFERENCES profiles(id);

alter table public."diagnostic_reports" add constraint "diagnostic_reports_lab_order_id_fkey" FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id);

alter table public."diagnostic_reports" add constraint "diagnostic_reports_laboratory_id_fkey" FOREIGN KEY (laboratory_id) REFERENCES laboratory_profiles(id);

alter table public."doctor_notes" add constraint "doctor_notes_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id);

alter table public."doctor_notes" add constraint "doctor_notes_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."doctor_notes" add constraint "doctor_notes_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."prescriptions" add constraint "prescriptions_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id);

alter table public."prescriptions" add constraint "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."prescriptions" add constraint "prescriptions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."lab_dispatches" add constraint "lab_dispatches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;

alter table public."lab_dispatches" add constraint "lab_dispatches_lab_order_id_fkey" FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE SET NULL;

alter table public."lab_dispatches" add constraint "lab_dispatches_laboratory_branch_id_fkey" FOREIGN KEY (laboratory_branch_id) REFERENCES laboratory_branches(id) ON DELETE RESTRICT;

alter table public."lab_dispatches" add constraint "lab_dispatches_physician_lab_request_id_fkey" FOREIGN KEY (physician_lab_request_id) REFERENCES physician_lab_requests(id) ON DELETE RESTRICT;

alter table public."lab_dispatches" add constraint "lab_dispatches_responded_by_fkey" FOREIGN KEY (responded_by) REFERENCES laboratory_profiles(id) ON DELETE SET NULL;

alter table public."physician_lab_requests" add constraint "physician_lab_requests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;

alter table public."physician_lab_requests" add constraint "physician_lab_requests_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE RESTRICT;

alter table public."physician_lab_requests" add constraint "physician_lab_requests_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE RESTRICT;

alter table public."notifications" add constraint "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES profiles(id);

alter table public."notifications" add constraint "notifications_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES profiles(id);

alter table public."prescription_items" add constraint "prescription_items_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

alter table public."ai_analyses" add constraint "ai_analyses_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id);

alter table public."ai_analyses" add constraint "ai_analyses_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."ai_analyses" add constraint "ai_analyses_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES doctor_profiles(id);

alter table public."trend_analyses" add constraint "trend_analyses_current_observation_id_fkey" FOREIGN KEY (current_observation_id) REFERENCES observations(id);

alter table public."trend_analyses" add constraint "trend_analyses_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."trend_analyses" add constraint "trend_analyses_previous_observation_id_fkey" FOREIGN KEY (previous_observation_id) REFERENCES observations(id);

alter table public."trend_analyses" add constraint "trend_analyses_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id);

alter table public."laboratory_branches" add constraint "laboratory_branches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."laboratory_branches" add constraint "laboratory_branches_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

alter table public."laboratory_branch_members" add constraint "laboratory_branch_members_branch_id_fkey" FOREIGN KEY (branch_id) REFERENCES laboratory_branches(id) ON DELETE CASCADE;

alter table public."laboratory_branch_members" add constraint "laboratory_branch_members_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."laboratory_branch_members" add constraint "laboratory_branch_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES laboratory_profiles(id) ON DELETE CASCADE;

alter table public."physician_lab_request_items" add constraint "physician_lab_request_items_physician_lab_request_id_fkey" FOREIGN KEY (physician_lab_request_id) REFERENCES physician_lab_requests(id) ON DELETE CASCADE;

alter table public."physician_lab_request_items" add constraint "physician_lab_request_items_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id) ON DELETE RESTRICT;

alter table public."physician_lab_request_items" add constraint "physician_lab_request_items_test_panel_id_fkey" FOREIGN KEY (test_panel_id) REFERENCES test_panels(id) ON DELETE RESTRICT;

alter table public."home_collection_requests" add constraint "home_collection_requests_collector_profile_id_fkey" FOREIGN KEY (collector_profile_id) REFERENCES laboratory_profiles(id) ON DELETE SET NULL;

alter table public."home_collection_requests" add constraint "home_collection_requests_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE RESTRICT;

alter table public."home_collection_requests" add constraint "home_collection_requests_lab_dispatch_id_fkey" FOREIGN KEY (lab_dispatch_id) REFERENCES lab_dispatches(id) ON DELETE RESTRICT;

alter table public."home_collection_requests" add constraint "home_collection_requests_lab_order_id_fkey" FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE SET NULL;

alter table public."home_collection_requests" add constraint "home_collection_requests_laboratory_branch_id_fkey" FOREIGN KEY (laboratory_branch_id) REFERENCES laboratory_branches(id) ON DELETE RESTRICT;

alter table public."home_collection_requests" add constraint "home_collection_requests_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE RESTRICT;

alter table public."home_collection_requests" add constraint "home_collection_requests_physician_lab_request_id_fkey" FOREIGN KEY (physician_lab_request_id) REFERENCES physician_lab_requests(id) ON DELETE RESTRICT;

alter table public."home_collection_private_details" add constraint "home_collection_private_details_home_collection_request_id_fkey" FOREIGN KEY (home_collection_request_id) REFERENCES home_collection_requests(id) ON DELETE CASCADE;

alter table public."home_collection_private_details" add constraint "home_collection_private_details_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE RESTRICT;

alter table public."lab_order_items" add constraint "lab_order_items_lab_order_id_fkey" FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE CASCADE;

alter table public."lab_order_items" add constraint "lab_order_items_test_definition_id_fkey" FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id);

alter table public."lab_order_items" add constraint "lab_order_items_test_panel_id_fkey" FOREIGN KEY (test_panel_id) REFERENCES test_panels(id);

alter table public."attachments" add constraint "attachments_diagnostic_report_id_fkey" FOREIGN KEY (diagnostic_report_id) REFERENCES diagnostic_reports(id);

alter table public."attachments" add constraint "attachments_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES profiles(id);

alter table public."audit_logs" add constraint "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id);

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_dispatch_id_fkey" FOREIGN KEY (dispatch_id) REFERENCES lab_dispatches(id) ON DELETE CASCADE;

alter table public."lab_workflow_qr_tokens" add constraint "lab_workflow_qr_tokens_home_collection_request_id_fkey" FOREIGN KEY (home_collection_request_id) REFERENCES home_collection_requests(id) ON DELETE CASCADE;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_home_collection_request_id_fkey" FOREIGN KEY (home_collection_request_id) REFERENCES home_collection_requests(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_lab_dispatch_id_fkey" FOREIGN KEY (lab_dispatch_id) REFERENCES lab_dispatches(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_lab_order_id_fkey" FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_laboratory_branch_id_fkey" FOREIGN KEY (laboratory_branch_id) REFERENCES laboratory_branches(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE SET NULL;

alter table public."lab_workflow_events" add constraint "lab_workflow_events_physician_lab_request_id_fkey" FOREIGN KEY (physician_lab_request_id) REFERENCES physician_lab_requests(id) ON DELETE SET NULL;

alter table public."consents" add constraint "consents_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."admin_profiles" add constraint "admin_profiles_id_fkey" FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."follow_ups" add constraint "follow_ups_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."follow_ups" add constraint "follow_ups_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."voice_notes" add constraint "voice_notes_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."voice_notes" add constraint "voice_notes_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."voice_notes" add constraint "voice_notes_visit_id_fkey" FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE;

alter table public."visits" add constraint "visits_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id);

alter table public."visits" add constraint "visits_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patient_profiles(id);

alter table public."transcripts" add constraint "transcripts_voice_note_id_fkey" FOREIGN KEY (voice_note_id) REFERENCES voice_notes(id) ON DELETE CASCADE;

alter table public."visit_summaries" add constraint "visit_summaries_voice_note_id_fkey" FOREIGN KEY (voice_note_id) REFERENCES voice_notes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS guest_result_accesses_pkey ON public.guest_result_accesses USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS guest_result_accesses_token_hash_key ON public.guest_result_accesses USING btree (token_hash);

CREATE INDEX IF NOT EXISTS idx_guest_result_accesses_active_lookup ON public.guest_result_accesses USING btree (token_hash, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_guest_result_accesses_report ON public.guest_result_accesses USING btree (diagnostic_report_id);

CREATE INDEX IF NOT EXISTS idx_guest_result_accesses_expires ON public.guest_result_accesses USING btree (expires_at) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_national_id ON public.profiles USING btree (national_id) WHERE (national_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles USING btree (phone);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_profiles_pkey ON public.doctor_profiles USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_profiles_medical_license_number_key ON public.doctor_profiles USING btree (medical_license_number);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_verified_by ON public.doctor_profiles USING btree (verified_by);

CREATE UNIQUE INDEX IF NOT EXISTS patient_profiles_pkey ON public.patient_profiles USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_pkey ON public.organizations USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_pkey ON public.organization_members USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_organization_id_profile_id_key ON public.organization_members USING btree (organization_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_profile_id ON public.organization_members USING btree (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS laboratory_profiles_pkey ON public.laboratory_profiles USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS laboratory_profiles_license_number_key ON public.laboratory_profiles USING btree (license_number);

CREATE INDEX IF NOT EXISTS idx_laboratory_profiles_organization_id ON public.laboratory_profiles USING btree (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS patient_doctor_relationships_pkey ON public.patient_doctor_relationships USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pdr_one_active_per_pair ON public.patient_doctor_relationships USING btree (patient_id, doctor_id) WHERE (status = 'active'::relationship_status);

CREATE INDEX IF NOT EXISTS idx_pdr_patient ON public.patient_doctor_relationships USING btree (patient_id) WHERE (status = 'active'::relationship_status);

CREATE INDEX IF NOT EXISTS idx_pdr_doctor ON public.patient_doctor_relationships USING btree (doctor_id) WHERE (status = 'active'::relationship_status);

CREATE INDEX IF NOT EXISTS idx_pdr_patient_doctor_status ON public.patient_doctor_relationships USING btree (patient_id, doctor_id, status);

CREATE INDEX IF NOT EXISTS idx_pdr_created_by ON public.patient_doctor_relationships USING btree (created_by);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pdr_one_pending_per_pair ON public.patient_doctor_relationships USING btree (patient_id, doctor_id) WHERE (status = 'pending'::relationship_status);

CREATE UNIQUE INDEX IF NOT EXISTS test_definitions_pkey ON public.test_definitions USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS test_definitions_internal_code_key ON public.test_definitions USING btree (internal_code);

CREATE UNIQUE INDEX IF NOT EXISTS test_aliases_pkey ON public.test_aliases USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_global ON public.test_aliases USING btree (alias) WHERE (source_lab_id IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_per_lab ON public.test_aliases USING btree (alias, source_lab_id) WHERE (source_lab_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_test_aliases_def ON public.test_aliases USING btree (test_definition_id);

CREATE INDEX IF NOT EXISTS idx_test_aliases_source_lab_id ON public.test_aliases USING btree (source_lab_id);

CREATE UNIQUE INDEX IF NOT EXISTS test_panels_pkey ON public.test_panels USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS test_panels_code_key ON public.test_panels USING btree (code);

CREATE UNIQUE INDEX IF NOT EXISTS test_panel_items_pkey ON public.test_panel_items USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS test_panel_items_panel_id_test_definition_id_key ON public.test_panel_items USING btree (panel_id, test_definition_id);

CREATE INDEX IF NOT EXISTS idx_test_panel_items_panel ON public.test_panel_items USING btree (panel_id);

CREATE INDEX IF NOT EXISTS idx_test_panel_items_test_definition_id ON public.test_panel_items USING btree (test_definition_id);

CREATE UNIQUE INDEX IF NOT EXISTS reference_range_templates_pkey ON public.reference_range_templates USING btree (id);

CREATE INDEX IF NOT EXISTS idx_reference_range_templates_laboratory_id ON public.reference_range_templates USING btree (laboratory_id);

CREATE INDEX IF NOT EXISTS idx_reference_range_templates_test_definition_id ON public.reference_range_templates USING btree (test_definition_id);

CREATE UNIQUE INDEX IF NOT EXISTS lab_orders_pkey ON public.lab_orders USING btree (id);

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON public.lab_orders USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor ON public.lab_orders USING btree (doctor_id);

CREATE INDEX IF NOT EXISTS idx_lab_orders_lab ON public.lab_orders USING btree (laboratory_id) WHERE (status = ANY (ARRAY['pending'::order_status, 'received_by_lab'::order_status, 'in_progress'::order_status]));

CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON public.lab_orders USING btree (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_orders_dispatch ON public.lab_orders USING btree (lab_dispatch_id) WHERE (lab_dispatch_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS observations_pkey ON public.observations USING btree (id);

CREATE INDEX IF NOT EXISTS idx_obs_report ON public.observations USING btree (diagnostic_report_id);

CREATE INDEX IF NOT EXISTS idx_obs_test_def ON public.observations USING btree (test_definition_id);

CREATE INDEX IF NOT EXISTS idx_obs_trend ON public.observations USING btree (test_definition_id, observed_at) WHERE (status = 'final'::observation_status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_observations_one_current ON public.observations USING btree (diagnostic_report_id, test_definition_id) WHERE (status = ANY (ARRAY['final'::observation_status, 'corrected'::observation_status]));

CREATE INDEX IF NOT EXISTS idx_observations_trend ON public.observations USING btree (test_definition_id, observed_at) WHERE (status = ANY (ARRAY['final'::observation_status, 'corrected'::observation_status]));

CREATE UNIQUE INDEX IF NOT EXISTS ux_obs_supersedes_unique ON public.observations USING btree (supersedes_observation_id) WHERE (supersedes_observation_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_observations_entered_by ON public.observations USING btree (entered_by);

CREATE INDEX IF NOT EXISTS idx_observations_reference_range_template_id ON public.observations USING btree (reference_range_template_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_observations_one_preliminary_per_test ON public.observations USING btree (diagnostic_report_id, test_definition_id) WHERE (status = 'preliminary'::observation_status);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_interpretations_pkey ON public.doctor_interpretations USING btree (id);

CREATE INDEX IF NOT EXISTS idx_interp_report ON public.doctor_interpretations USING btree (diagnostic_report_id);

CREATE INDEX IF NOT EXISTS idx_doctor_interpretations_doctor_id ON public.doctor_interpretations USING btree (doctor_id);

CREATE UNIQUE INDEX IF NOT EXISTS diagnostic_reports_pkey ON public.diagnostic_reports USING btree (id);

CREATE INDEX IF NOT EXISTS idx_diag_reports_order ON public.diagnostic_reports USING btree (lab_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_diagnostic_reports_order ON public.diagnostic_reports USING btree (lab_order_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_lab ON public.diagnostic_reports USING btree (laboratory_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_entered_by ON public.diagnostic_reports USING btree (entered_by);

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_finalized_by ON public.diagnostic_reports USING btree (finalized_by);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_notes_pkey ON public.doctor_notes USING btree (id);

CREATE INDEX IF NOT EXISTS idx_notes_patient ON public.doctor_notes USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_doctor_notes_diagnostic_report_id ON public.doctor_notes USING btree (diagnostic_report_id);

CREATE INDEX IF NOT EXISTS idx_doctor_notes_doctor_id ON public.doctor_notes USING btree (doctor_id);

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_pkey ON public.prescriptions USING btree (id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON public.prescriptions USING btree (doctor_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_diagnostic_report_id ON public.prescriptions USING btree (diagnostic_report_id);

CREATE UNIQUE INDEX IF NOT EXISTS lab_dispatches_pkey ON public.lab_dispatches USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS lab_dispatches_lab_order_id_key ON public.lab_dispatches USING btree (lab_order_id);

CREATE INDEX IF NOT EXISTS idx_lab_dispatches_branch_status ON public.lab_dispatches USING btree (laboratory_branch_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_dispatches_request ON public.lab_dispatches USING btree (physician_lab_request_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_dispatch_one_pending_per_request ON public.lab_dispatches USING btree (physician_lab_request_id) WHERE (status = 'pending'::text);

CREATE UNIQUE INDEX IF NOT EXISTS physician_lab_requests_pkey ON public.physician_lab_requests USING btree (id);

CREATE INDEX IF NOT EXISTS idx_physician_lab_requests_doctor ON public.physician_lab_requests USING btree (doctor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_physician_lab_requests_patient ON public.physician_lab_requests USING btree (patient_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_pkey ON public.notifications USING btree (id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications USING btree (recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status ON public.notifications USING btree (recipient_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS prescription_items_pkey ON public.prescription_items USING btree (id);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON public.prescription_items USING btree (prescription_id);

CREATE UNIQUE INDEX IF NOT EXISTS ai_analyses_pkey ON public.ai_analyses USING btree (id);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_report ON public.ai_analyses USING btree (diagnostic_report_id);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_patient_id ON public.ai_analyses USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_reviewed_by ON public.ai_analyses USING btree (reviewed_by);

CREATE UNIQUE INDEX IF NOT EXISTS trend_analyses_pkey ON public.trend_analyses USING btree (id);

CREATE INDEX IF NOT EXISTS idx_trend_patient_test ON public.trend_analyses USING btree (patient_id, test_definition_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trend_analyses_current_observation_id ON public.trend_analyses USING btree (current_observation_id);

CREATE INDEX IF NOT EXISTS idx_trend_analyses_previous_observation_id ON public.trend_analyses USING btree (previous_observation_id);

CREATE INDEX IF NOT EXISTS idx_trend_analyses_test_definition_id ON public.trend_analyses USING btree (test_definition_id);

CREATE UNIQUE INDEX IF NOT EXISTS laboratory_branches_pkey ON public.laboratory_branches USING btree (id);

CREATE INDEX IF NOT EXISTS idx_laboratory_branches_catalog ON public.laboratory_branches USING btree (is_active, city, display_name);

CREATE INDEX IF NOT EXISTS idx_laboratory_branches_organization ON public.laboratory_branches USING btree (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS laboratory_branch_members_pkey ON public.laboratory_branch_members USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS laboratory_branch_members_branch_id_profile_id_key ON public.laboratory_branch_members USING btree (branch_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_lab_branch_members_profile ON public.laboratory_branch_members USING btree (profile_id, is_active, branch_id);

CREATE UNIQUE INDEX IF NOT EXISTS physician_lab_request_items_pkey ON public.physician_lab_request_items USING btree (id);

CREATE INDEX IF NOT EXISTS idx_physician_lab_request_items_request ON public.physician_lab_request_items USING btree (physician_lab_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS home_collection_requests_pkey ON public.home_collection_requests USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS home_collection_requests_lab_dispatch_id_key ON public.home_collection_requests USING btree (lab_dispatch_id);

CREATE INDEX IF NOT EXISTS idx_home_collection_branch_status ON public.home_collection_requests USING btree (laboratory_branch_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_home_collection_patient_status ON public.home_collection_requests USING btree (patient_id, status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS home_collection_private_details_pkey ON public.home_collection_private_details USING btree (home_collection_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_order_items_test ON public.lab_order_items USING btree (lab_order_id, test_definition_id) WHERE (test_definition_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS lab_order_items_pkey ON public.lab_order_items USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_order_items_panel ON public.lab_order_items USING btree (lab_order_id, test_panel_id) WHERE (test_panel_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_lab_order_items_order ON public.lab_order_items USING btree (lab_order_id);

CREATE INDEX IF NOT EXISTS idx_lab_order_items_test_definition_id ON public.lab_order_items USING btree (test_definition_id);

CREATE INDEX IF NOT EXISTS idx_lab_order_items_test_panel_id ON public.lab_order_items USING btree (test_panel_id);

CREATE UNIQUE INDEX IF NOT EXISTS attachments_pkey ON public.attachments USING btree (id);

CREATE INDEX IF NOT EXISTS idx_attachments_diagnostic_report_id ON public.attachments USING btree (diagnostic_report_id);

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON public.attachments USING btree (uploaded_by);

CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs USING btree (actor_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS lab_workflow_qr_tokens_pkey ON public.lab_workflow_qr_tokens USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS lab_workflow_qr_tokens_token_hash_key ON public.lab_workflow_qr_tokens USING btree (token_hash);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_qr_dispatch ON public.lab_workflow_qr_tokens USING btree (dispatch_id, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_qr_home_collection ON public.lab_workflow_qr_tokens USING btree (home_collection_request_id, expires_at) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS lab_workflow_events_pkey ON public.lab_workflow_events USING btree (id);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_events_request ON public.lab_workflow_events USING btree (physician_lab_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_events_order ON public.lab_workflow_events USING btree (lab_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_workflow_events_branch ON public.lab_workflow_events USING btree (laboratory_branch_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS consents_pkey ON public.consents USING btree (id);

CREATE INDEX IF NOT EXISTS idx_consents_patient ON public.consents USING btree (patient_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_active_voice_recording_consent ON public.consents USING btree (patient_id) WHERE ((consent_type = 'physician_voice_recording'::text) AND (granted IS TRUE) AND (revoked_at IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS admin_profiles_pkey ON public.admin_profiles USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS admin_profiles_personnel_code_unique ON public.admin_profiles USING btree (personnel_code);

CREATE UNIQUE INDEX IF NOT EXISTS follow_ups_pkey ON public.follow_ups USING btree (id);

CREATE INDEX IF NOT EXISTS idx_follow_ups_doctor_due ON public.follow_ups USING btree (doctor_id, due_date);

CREATE INDEX IF NOT EXISTS idx_follow_ups_patient_due ON public.follow_ups USING btree (patient_id, due_date);

CREATE UNIQUE INDEX IF NOT EXISTS voice_notes_pkey ON public.voice_notes USING btree (id);

CREATE INDEX IF NOT EXISTS idx_voice_notes_visit ON public.voice_notes USING btree (visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_notes_patient ON public.voice_notes USING btree (patient_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS visits_pkey ON public.visits USING btree (id);

CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON public.visits USING btree (patient_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_visits_doctor_date ON public.visits USING btree (doctor_id, visit_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS transcripts_pkey ON public.transcripts USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS transcripts_voice_note_id_key ON public.transcripts USING btree (voice_note_id);

CREATE UNIQUE INDEX IF NOT EXISTS visit_summaries_pkey ON public.visit_summaries USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS visit_summaries_voice_note_id_key ON public.visit_summaries USING btree (voice_note_id);

CREATE INDEX IF NOT EXISTS idx_visit_summaries_voice_note ON public.visit_summaries USING btree (voice_note_id);

CREATE OR REPLACE FUNCTION private.my_organization_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT organization_id
  FROM public.organization_members
  WHERE profile_id = (SELECT auth.uid());
$function$;

revoke all on function "private"."my_organization_ids"() from public,anon,authenticated,service_role;

grant execute on function "private"."my_organization_ids"() to "postgres";

grant execute on function "private"."my_organization_ids"() to "authenticated";

CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  SELECT auth.uid();
$function$;

revoke all on function "public"."current_user_id"() from public,anon,authenticated,service_role;

grant execute on function "public"."current_user_id"() to public;

grant execute on function "public"."current_user_id"() to "postgres";

grant execute on function "public"."current_user_id"() to "authenticated";

grant execute on function "public"."current_user_id"() to "anon";

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  SELECT auth.role();
$function$;

revoke all on function "public"."current_user_role"() from public,anon,authenticated,service_role;

grant execute on function "public"."current_user_role"() to public;

grant execute on function "public"."current_user_role"() to "postgres";

grant execute on function "public"."current_user_role"() to "authenticated";

grant execute on function "public"."current_user_role"() to "anon";

CREATE OR REPLACE FUNCTION public.sync_notification_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if new.status = 'reviewed' then
    new.is_read := true;

    if old.status is distinct from 'reviewed' or old.reviewed_at is null then
      new.reviewed_at := now();
    else
      new.reviewed_at := old.reviewed_at;
    end if;

    -- Do not trust a caller-supplied reviewed_by value.
    if v_uid is not null then
      new.reviewed_by := v_uid;
    else
      new.reviewed_by := null;
    end if;

  elsif new.status = 'read' then
    new.is_read := true;
    new.reviewed_at := null;
    new.reviewed_by := null;

  elsif new.status = 'unread' then
    new.is_read := false;
    new.reviewed_at := null;
    new.reviewed_by := null;

  elsif new.is_read is distinct from old.is_read then
    new.status := case when new.is_read then 'read' else 'unread' end;
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;

  return new;
end;
$function$;

revoke all on function "public"."sync_notification_status"() from public,anon,authenticated,service_role;

grant execute on function "public"."sync_notification_status"() to "postgres";

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

revoke all on function "public"."rls_auto_enable"() from public,anon,authenticated,service_role;

grant execute on function "public"."rls_auto_enable"() to "postgres";

CREATE OR REPLACE FUNCTION public.is_service_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  SELECT
    coalesce(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
$function$;

revoke all on function "public"."is_service_role"() from public,anon,authenticated,service_role;

grant execute on function "public"."is_service_role"() to public;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

revoke all on function "public"."set_updated_at"() from public,anon,authenticated,service_role;

grant execute on function "public"."set_updated_at"() to public;

CREATE OR REPLACE FUNCTION public.guard_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF coalesce(current_setting('app.auth_user_trigger', true), '') = 'true' THEN
      IF NEW.role <> 'patient' THEN
        RAISE EXCEPTION 'Self-registration is only allowed for patient role';
      END IF;
      RETURN NEW;
    END IF;

    IF auth.uid() IS NULL OR NEW.id <> auth.uid() THEN
      RAISE EXCEPTION 'Cannot create profile for another user';
    END IF;

    IF NEW.role <> 'patient' THEN
      RAISE EXCEPTION 'Self-registration is only allowed for patient role';
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'profiles.id is immutable';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profiles.role is immutable';
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      RAISE EXCEPTION 'profiles.phone is authentication-controlled';
    END IF;
    IF NEW.national_id IS DISTINCT FROM OLD.national_id THEN
      RAISE EXCEPTION 'profiles.national_id is authentication-controlled';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'profiles.created_at is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_profile_role"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_profile_role"() to "postgres";

grant execute on function "public"."guard_profile_role"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_doctor_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id <> auth.uid() THEN
      RAISE EXCEPTION 'Cannot create another doctor profile';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.id AND p.role = 'doctor'
    ) THEN
      RAISE EXCEPTION 'Profile role must be doctor';
    END IF;
    IF NEW.is_verified IS TRUE THEN
      RAISE EXCEPTION 'Doctor cannot self-verify';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'doctor_profiles.id is immutable';
    END IF;
    IF NEW.medical_license_number IS DISTINCT FROM OLD.medical_license_number THEN
      RAISE EXCEPTION 'medical_license_number is immutable';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.verified_by IS DISTINCT FROM OLD.verified_by THEN
      RAISE EXCEPTION 'Verification fields are admin-controlled';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_doctor_profile"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_doctor_profile"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_ai_analysis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.is_service_role() THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.diagnostic_report_id IS DISTINCT FROM OLD.diagnostic_report_id
       OR NEW.model IS DISTINCT FROM OLD.model
       OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
       OR NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
       OR NEW.output IS DISTINCT FROM OLD.output
       OR NEW.analysis_type IS DISTINCT FROM OLD.analysis_type
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'AI analysis source data is immutable';
    END IF;

    IF NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.final_edited_content IS DISTINCT FROM OLD.final_edited_content
       OR NEW.is_visible_to_patient IS DISTINCT FROM OLD.is_visible_to_patient THEN
      IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id=v_uid AND dp.is_verified=true) THEN
        RAISE EXCEPTION 'Doctor must be verified';
      END IF;
      IF NEW.reviewed_by IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'reviewed_by must equal current doctor';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.patient_doctor_relationships pdr
        WHERE pdr.patient_id=NEW.patient_id
          AND pdr.doctor_id=v_uid
          AND pdr.status='active'
      ) THEN
        RAISE EXCEPTION 'Doctor is not authorized for this patient';
      END IF;
      IF NEW.is_visible_to_patient = true AND NEW.review_status NOT IN ('approved','edited') THEN
        RAISE EXCEPTION 'Patient visibility requires approved or edited review_status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_ai_analysis"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_ai_analysis"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_pdr()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'created_by must equal current user';
    END IF;
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'New relationships must start as pending';
    END IF;
    IF NEW.patient_id <> v_uid AND NEW.doctor_id <> v_uid THEN
      RAISE EXCEPTION 'Relationship must include current user';
    END IF;
    IF NEW.ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'New relationships cannot already be ended';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = NEW.doctor_id AND dp.is_verified = true
    ) THEN
      RAISE EXCEPTION 'Target doctor must be verified to create a relationship';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.patient_doctor_relationships existing
      WHERE existing.patient_id = NEW.patient_id
        AND existing.doctor_id = NEW.doctor_id
        AND existing.status IN ('active', 'pending')
    ) THEN
      RAISE EXCEPTION 'An active relationship or pending request already exists';
    END IF;

    NEW.ended_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
     OR NEW.relationship_type IS DISTINCT FROM OLD.relationship_type
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Relationship identity and provenance are immutable';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
      RAISE EXCEPTION 'ended_at can only change with relationship status';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'active' THEN
    IF v_uid <> OLD.patient_id AND v_uid <> OLD.doctor_id THEN
      RAISE EXCEPTION 'Only a relationship participant can approve it';
    END IF;
    IF v_uid = OLD.created_by THEN
      RAISE EXCEPTION 'The requester cannot approve their own relationship';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = OLD.doctor_id AND dp.is_verified = true
    ) THEN
      RAISE EXCEPTION 'Doctor must be verified to activate a relationship';
    END IF;
    NEW.ended_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status = 'inactive' AND OLD.status IN ('pending', 'active') THEN
    IF v_uid <> OLD.patient_id AND v_uid <> OLD.doctor_id THEN
      RAISE EXCEPTION 'Only a relationship participant can end it';
    END IF;
    NEW.ended_at := COALESCE(OLD.ended_at, now());
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid relationship status transition';
END;
$function$;

revoke all on function "public"."guard_pdr"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_pdr"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_laboratory_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id <> auth.uid() THEN
      RAISE EXCEPTION 'Cannot create another laboratory profile';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.id AND p.role = 'laboratory'
    ) THEN
      RAISE EXCEPTION 'Profile role must be laboratory';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'laboratory_profiles.id is immutable';
    END IF;
    IF NEW.license_number IS DISTINCT FROM OLD.license_number THEN
      RAISE EXCEPTION 'license_number is immutable';
    END IF;
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'organization_id is admin-controlled';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_laboratory_profile"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_laboratory_profile"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_admin_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  profile_role text;
BEGIN
  SELECT p.role
  INTO profile_role
  FROM public.profiles p
  WHERE p.id = NEW.id;

  IF profile_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin_profiles requires profiles.role = admin';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'admin_profiles.id is immutable';
  END IF;

  IF NEW.personnel_code <> btrim(NEW.personnel_code) THEN
    RAISE EXCEPTION 'personnel_code must be trimmed';
  END IF;

  IF NEW.personnel_code = '' THEN
    RAISE EXCEPTION 'personnel_code must not be empty';
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_admin_profile"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_admin_profile"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_admin_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND OLD.role = 'admin'
     AND NEW.role IS DISTINCT FROM 'admin'
     AND EXISTS (
       SELECT 1
       FROM public.admin_profiles ap
       WHERE ap.id = OLD.id
     )
  THEN
    RAISE EXCEPTION
      'Cannot change admin role while admin_profiles exists';
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_admin_role_change"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_admin_role_change"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.related_entity_type IS DISTINCT FROM OLD.related_entity_type
       OR NEW.related_entity_id IS DISTINCT FROM OLD.related_entity_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Notification content cannot be modified';
    END IF;

    IF v_uid IS NULL OR NEW.recipient_id <> v_uid THEN
      RAISE EXCEPTION 'Cannot modify another user notification';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_notification"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_notification"() to "postgres";

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM set_config('app.auth_user_trigger', 'true', true);

  INSERT INTO public.profiles (
    id, role, full_name, phone, national_id, avatar_url
  )
  VALUES (
    NEW.id,
    'patient',
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      ''
    ),
    NEW.phone,
    NULLIF(NEW.raw_user_meta_data->>'national_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."handle_new_user"() from public,anon,authenticated,service_role;

grant execute on function "public"."handle_new_user"() to "postgres";

grant execute on function "public"."handle_new_user"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_visit_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid;
  v_confirmation_id text;
  v_key text;
  v_value text;
  v_total_length integer := 0;
  v_summary text := '';
  v_label text;
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  select patient_id into v_patient_id
  from public.voice_notes
  where id = new.voice_note_id
    and archived_at is null
    and doctor_id = v_uid;

  if v_patient_id is null then
    raise exception 'Summary voice note must belong to current doctor';
  end if;

  if not exists (
    select 1 from public.doctor_profiles
    where id = v_uid and is_verified = true
  ) then
    raise exception 'Doctor must be verified';
  end if;

  if not exists (
    select 1 from public.patient_doctor_relationships
    where doctor_id = v_uid
      and patient_id = v_patient_id
      and status = 'active'
  ) then
    raise exception 'Doctor has no active relationship with patient';
  end if;

  if new.structured_content is null
     or jsonb_typeof(new.structured_content) is distinct from 'object' then
    raise exception 'Structured visit summary must be a JSON object';
  end if;

  for v_key, v_value in
    select key, value #>> '{}'
    from jsonb_each(new.structured_content)
  loop
    if v_key not in (
      'chief_complaint',
      'history',
      'exam_findings',
      'clinical_assessment',
      'plan',
      'follow_up_instructions'
    ) then
      raise exception 'Unsupported structured visit summary field';
    end if;

    if jsonb_typeof(new.structured_content -> v_key) is distinct from 'string' then
      raise exception 'Structured visit summary fields must be text';
    end if;

    if length(coalesce(v_value, '')) > 3000 then
      raise exception 'A structured visit summary field exceeds 3000 characters';
    end if;

    v_total_length := v_total_length + length(coalesce(v_value, ''));
  end loop;

  if v_total_length > 10000 then
    raise exception 'Structured visit summary exceeds 10000 characters';
  end if;

  if not exists (
    select 1
    from jsonb_each_text(new.structured_content) e
    where length(btrim(e.value)) > 0
  ) then
    raise exception 'Structured visit summary cannot be empty';
  end if;

  v_summary := concat_ws(E'\n\n',
    nullif('علت مراجعه: ' || btrim(coalesce(new.structured_content ->> 'chief_complaint', '')), 'علت مراجعه: '),
    nullif('شرح حال: ' || btrim(coalesce(new.structured_content ->> 'history', '')), 'شرح حال: '),
    nullif('یافته‌های ثبت‌شده: ' || btrim(coalesce(new.structured_content ->> 'exam_findings', '')), 'یافته‌های ثبت‌شده: '),
    nullif('ارزیابی پزشک: ' || btrim(coalesce(new.structured_content ->> 'clinical_assessment', '')), 'ارزیابی پزشک: '),
    nullif('برنامه: ' || btrim(coalesce(new.structured_content ->> 'plan', '')), 'برنامه: '),
    nullif('دستور پیگیری: ' || btrim(coalesce(new.structured_content ->> 'follow_up_instructions', '')), 'دستور پیگیری: ')
  );
  new.summary := v_summary;

  if tg_op = 'INSERT' then
    if new.doctor_confirmed is distinct from false or new.confirmed_at is not null then
      raise exception 'New visit summaries must start as unconfirmed drafts';
    end if;
    if new.updated_at is null then new.updated_at := now(); end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.voice_note_id is distinct from old.voice_note_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Visit summary identity is immutable';
  end if;

  if old.doctor_confirmed is true then
    if new.structured_content is distinct from old.structured_content
       or new.summary is distinct from old.summary
       or new.doctor_confirmed is distinct from old.doctor_confirmed
       or new.confirmed_at is distinct from old.confirmed_at
       or new.updated_at is distinct from old.updated_at then
      raise exception 'Confirmed visit summary is immutable';
    end if;
    return new;
  end if;

  if new.doctor_confirmed is true then
    v_confirmation_id := current_setting('app.pab_visit_summary_confirmation', true);
    if v_confirmation_id is distinct from new.voice_note_id::text then
      raise exception 'Use the explicit physician summary confirmation action';
    end if;
    if new.confirmed_at is null then
      raise exception 'Confirmed summary requires confirmed_at';
    end if;
    new.updated_at := now();
  elsif new.confirmed_at is not null then
    raise exception 'Draft summary cannot have confirmed_at';
  else
    new.updated_at := now();
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_visit_summary"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_visit_summary"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_doctor_interpretation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
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
      RAISE EXCEPTION 'Interpretation doctor must equal current user';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.diagnostic_reports dr
      JOIN public.lab_orders lo ON lo.id = dr.lab_order_id
      JOIN public.patient_doctor_relationships pdr
        ON pdr.patient_id = lo.patient_id
       AND pdr.doctor_id = v_uid
       AND pdr.status = 'active'
      WHERE dr.id = NEW.diagnostic_report_id
        AND dr.status IN ('final', 'amended')
    ) THEN
      RAISE EXCEPTION 'Doctor is not authorized for this report';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
       OR NEW.diagnostic_report_id IS DISTINCT FROM OLD.diagnostic_report_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Interpretation identity cannot change';
    END IF;
    IF NEW.doctor_id <> v_uid THEN
      RAISE EXCEPTION 'Only interpretation owner can update it';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_doctor_interpretation"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_doctor_interpretation"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_prescription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
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

revoke all on function "public"."guard_prescription"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_prescription"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_observation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_value_type text;
  v_default_unit text;
  v_allows_negative boolean;
  v_order_id uuid;
  v_patient_id uuid;
  v_order_branch_id uuid;
  v_order_laboratory_id uuid;
  v_report_laboratory_id uuid;
  v_report_status text;
  v_patient_dob date;
  v_patient_sex text;
  v_patient_age integer;
  v_range public.reference_range_templates%rowtype;
  v_has_range boolean := false;
  v_old_unit text;
  v_old_reference_range_template_id uuid;
  v_old_reference_min numeric;
  v_old_reference_max numeric;
  v_old_reference_text text;
  v_old_reference_source text;
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  select td.value_type, td.default_unit, td.allows_negative, dr.lab_order_id,
         dr.status::text, dr.laboratory_id, lo.laboratory_branch_id,
         lo.laboratory_id, lo.patient_id
    into v_value_type, v_default_unit, v_allows_negative, v_order_id,
         v_report_status, v_report_laboratory_id, v_order_branch_id,
         v_order_laboratory_id, v_patient_id
  from public.test_definitions td
  join public.diagnostic_reports dr on dr.id = new.diagnostic_report_id
  join public.lab_orders lo on lo.id = dr.lab_order_id
  where td.id = new.test_definition_id;

  if v_value_type is null then
    raise exception 'Invalid test_definition_id or diagnostic_report_id';
  end if;

  if not (
    v_report_laboratory_id = v_uid
    or v_order_laboratory_id = v_uid
    or (v_order_branch_id is not null and public.is_laboratory_branch_member(v_order_branch_id, v_uid))
  ) then
    raise exception 'Laboratory account is not authorized for this report';
  end if;

  if not exists (
    select 1
    from public.lab_order_items loi
    where loi.lab_order_id = v_order_id
      and (
        loi.test_definition_id = new.test_definition_id
        or exists (
          select 1 from public.test_panel_items tpi
          where tpi.panel_id = loi.test_panel_id
            and tpi.test_definition_id = new.test_definition_id
        )
      )
  ) then
    raise exception 'Test is not part of the laboratory order';
  end if;

  if tg_op = 'INSERT' then
    if new.entered_by is distinct from v_uid then
      raise exception 'entered_by must equal current laboratory user';
    end if;

    if new.status not in ('preliminary', 'corrected') then
      raise exception 'New observations must start as preliminary or be a correction';
    end if;
    if new.status = 'preliminary' and v_report_status <> 'draft' then
      raise exception 'Preliminary observations require a draft report';
    end if;
    if new.status = 'corrected' and v_report_status not in ('final', 'amended') then
      raise exception 'Corrected observation requires a finalized report';
    end if;

    if new.status = 'preliminary' then
      select pp.date_of_birth, pp.sex
        into v_patient_dob, v_patient_sex
      from public.patient_profiles pp
      where pp.id = v_patient_id;

      if v_patient_dob is null or v_patient_dob > current_date then
        v_patient_age := null;
      else
        v_patient_age := date_part('year', age(current_date, v_patient_dob))::integer;
      end if;

      select rr.* into v_range
      from public.reference_range_templates rr
      where v_value_type = 'numeric'
        and rr.test_definition_id = new.test_definition_id
        and rr.is_active = true
        and (rr.laboratory_id = v_order_laboratory_id or rr.laboratory_id is null)
        and (
          lower(coalesce(rr.sex, 'any')) = 'any'
          or (
            v_patient_sex is not null
            and lower(rr.sex) = lower(v_patient_sex)
          )
        )
        and (
          (v_patient_age is null and rr.min_age_years is null and rr.max_age_years is null)
          or (
            v_patient_age is not null
            and (rr.min_age_years is null or v_patient_age >= rr.min_age_years)
            and (rr.max_age_years is null or v_patient_age <= rr.max_age_years)
          )
        )
      order by
        case when rr.laboratory_id = v_order_laboratory_id then 1 else 0 end desc,
        case
          when lower(coalesce(rr.sex, 'any')) <> 'any'
            and v_patient_sex is not null
            and lower(rr.sex) = lower(v_patient_sex) then 1
          else 0
        end desc,
        ((rr.min_age_years is not null)::integer + (rr.max_age_years is not null)::integer) desc,
        case
          when rr.min_age_years is not null and rr.max_age_years is not null
            then rr.max_age_years - rr.min_age_years
          else null
        end asc nulls last,
        rr.id asc
      limit 1;
      v_has_range := found;

      if v_has_range then
        if v_range.min_value is null and v_range.max_value is null then
          raise exception 'Numeric reference range must define at least one bound';
        end if;

        if (v_range.min_value is not null and v_range.min_value::text in ('NaN', 'Infinity', '-Infinity'))
           or (v_range.max_value is not null and v_range.max_value::text in ('NaN', 'Infinity', '-Infinity')) then
          raise exception 'Reference range contains a non-finite bound';
        end if;

        if v_range.min_value is not null
           and v_range.max_value is not null
           and v_range.min_value > v_range.max_value then
          raise exception 'Reference range minimum exceeds maximum';
        end if;

        if nullif(btrim(v_range.unit), '') is null then
          raise exception 'Reference range unit is required';
        end if;

        if nullif(btrim(v_default_unit), '') is not null
           and btrim(v_default_unit) <> btrim(v_range.unit) then
          raise exception 'Reference range unit does not match test definition';
        end if;

        new.reference_range_template_id := v_range.id;
        new.reference_min := v_range.min_value;
        new.reference_max := v_range.max_value;
        new.reference_text := case
          when v_range.min_value is not null and v_range.max_value is not null
            then v_range.min_value::text || ' – ' || v_range.max_value::text
          when v_range.min_value is not null
            then '≥ ' || v_range.min_value::text
          when v_range.max_value is not null
            then '≤ ' || v_range.max_value::text
          else null
        end;
        new.reference_source := case
          when v_range.laboratory_id is null then 'generic'
          else 'laboratory'
        end;
        new.unit := coalesce(nullif(btrim(v_default_unit), ''), nullif(btrim(v_range.unit), ''), '');
      else
        new.reference_range_template_id := null;
        new.reference_min := null;
        new.reference_max := null;
        new.reference_text := null;
        new.reference_source := null;
        new.unit := coalesce(nullif(btrim(v_default_unit), ''), '');
      end if;
    else
      select o.unit, o.reference_range_template_id, o.reference_min,
             o.reference_max, o.reference_text, o.reference_source
        into v_old_unit, v_old_reference_range_template_id, v_old_reference_min,
             v_old_reference_max, v_old_reference_text, v_old_reference_source
      from public.observations o
      where o.id = new.supersedes_observation_id
        and o.diagnostic_report_id = new.diagnostic_report_id
        and o.test_definition_id = new.test_definition_id
        and o.status = 'superseded';

      if not found then
        raise exception 'Corrected observation must supersede an observation of the same test and report';
      end if;

      new.unit := v_old_unit;
      new.reference_range_template_id := v_old_reference_range_template_id;
      new.reference_min := v_old_reference_min;
      new.reference_max := v_old_reference_max;
      new.reference_text := v_old_reference_text;
      new.reference_source := v_old_reference_source;
    end if;

    if v_value_type = 'numeric' then
      if new.value_numeric is null or new.value_text is not null or new.value_boolean is not null then
        raise exception 'Numeric test requires only value_numeric';
      end if;
      if new.value_numeric::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'Numeric result must be finite';
      end if;
      if new.value_numeric < 0 and not v_allows_negative then
        raise exception 'Negative value is not allowed for this test';
      end if;

      if new.reference_min is null and new.reference_max is null then
        new.flag := 'unknown'::public.flag_status;
      elsif (new.reference_min is not null and new.reference_min::text in ('NaN', 'Infinity', '-Infinity'))
         or (new.reference_max is not null and new.reference_max::text in ('NaN', 'Infinity', '-Infinity')) then
        new.flag := 'unknown'::public.flag_status;
      elsif new.reference_min is not null and new.reference_max is not null
            and new.reference_min > new.reference_max then
        new.flag := 'unknown'::public.flag_status;
      elsif new.reference_min is not null and new.value_numeric < new.reference_min then
        new.flag := 'low'::public.flag_status;
      elsif new.reference_max is not null and new.value_numeric > new.reference_max then
        new.flag := 'high'::public.flag_status;
      else
        new.flag := 'normal'::public.flag_status;
      end if;
    elsif v_value_type = 'text' then
      if nullif(btrim(new.value_text), '') is null
         or new.value_numeric is not null or new.value_boolean is not null then
        raise exception 'Text test requires only value_text';
      end if;
      new.flag := 'unknown'::public.flag_status;
    elsif v_value_type = 'boolean' then
      if new.value_boolean is null or new.value_numeric is not null or new.value_text is not null then
        raise exception 'Boolean test requires only value_boolean';
      end if;
      new.flag := 'unknown'::public.flag_status;
    else
      raise exception 'Unsupported test value type';
    end if;
  end if;

  if new.status = 'corrected' and new.supersedes_observation_id is null then
    raise exception 'Corrected observation must reference a superseded observation';
  end if;

  if new.supersedes_observation_id is not null then
    if new.supersedes_observation_id = new.id then
      raise exception 'Observation cannot supersede itself';
    end if;
    if not exists (
      select 1 from public.observations old_obs
      where old_obs.id = new.supersedes_observation_id
        and old_obs.diagnostic_report_id = new.diagnostic_report_id
        and old_obs.test_definition_id = new.test_definition_id
        and old_obs.status = 'superseded'
    ) then
      raise exception 'Invalid supersedes chain: target must be a superseded observation of the same test and report';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.diagnostic_report_id is distinct from old.diagnostic_report_id
       or new.test_definition_id is distinct from old.test_definition_id
       or new.value_numeric is distinct from old.value_numeric
       or new.value_text is distinct from old.value_text
       or new.value_boolean is distinct from old.value_boolean
       or new.unit is distinct from old.unit
       or new.reference_range_template_id is distinct from old.reference_range_template_id
       or new.reference_min is distinct from old.reference_min
       or new.reference_max is distinct from old.reference_max
       or new.reference_text is distinct from old.reference_text
       or new.reference_source is distinct from old.reference_source
       or new.flag is distinct from old.flag
       or new.entered_by is distinct from old.entered_by
       or new.observed_at is distinct from old.observed_at
       or new.created_at is distinct from old.created_at
       or new.supersedes_observation_id is distinct from old.supersedes_observation_id then
      raise exception 'Observations are append-only; only status may change';
    end if;

    if new.status is distinct from old.status then
      if old.status = 'preliminary' and new.status not in ('final', 'superseded') then
        raise exception 'Invalid observation status transition';
      end if;
      if old.status = 'final' and new.status <> 'superseded' then
        raise exception 'Final observation can only become superseded';
      end if;
      if old.status = 'corrected' and new.status <> 'superseded' then
        raise exception 'Corrected observation can only become superseded';
      end if;
      if old.status = 'superseded' then
        raise exception 'Superseded observation cannot change status';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_observation"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_observation"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_lab_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dispatch public.lab_dispatches%rowtype;
begin
  if public.is_service_role() then
    return new;
  end if;

  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    if new.lab_dispatch_id is null
       or new.laboratory_branch_id is null
       or new.physician_lab_request_id is null then
      raise exception 'New operational lab orders must be created from an accepted laboratory dispatch';
    end if;

    if new.laboratory_id is distinct from v_uid then
      raise exception 'Accepting laboratory account must equal current user';
    end if;

    if not public.is_laboratory_branch_member(new.laboratory_branch_id, v_uid) then
      raise exception 'Only an authorized member of the destination branch can create an operational order';
    end if;

    select * into v_dispatch
    from public.lab_dispatches d
    where d.id = new.lab_dispatch_id
      and d.physician_lab_request_id = new.physician_lab_request_id
      and d.laboratory_branch_id = new.laboratory_branch_id
    for update;

    if not found
       or v_dispatch.status <> 'accepted'
       or v_dispatch.responded_by is distinct from v_uid
       or v_dispatch.lab_order_id is not null then
      raise exception 'Operational order requires an accepted dispatch with no existing order';
    end if;

    if new.status <> 'pending'
       or new.received_at is not null
       or new.completed_at is not null
       or new.cancelled_at is not null then
      raise exception 'Operational lab order must start as pending with empty workflow timestamps';
    end if;

    if not exists (
      select 1 from public.physician_lab_requests r
      where r.id = new.physician_lab_request_id
        and r.patient_id = new.patient_id
        and r.doctor_id = new.doctor_id
        and r.status = 'submitted'
    ) then
      raise exception 'Operational order does not match an active physician request';
    end if;

    return new;
  end if;

  if new.id is distinct from old.id
     or new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id
     or new.laboratory_id is distinct from old.laboratory_id
     or new.laboratory_branch_id is distinct from old.laboratory_branch_id
     or new.lab_dispatch_id is distinct from old.lab_dispatch_id
     or new.physician_lab_request_id is distinct from old.physician_lab_request_id
     or new.ordered_at is distinct from old.ordered_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Immutable lab order fields cannot change';
  end if;

  if v_uid = old.doctor_id then
    if not exists (
      select 1 from public.doctor_profiles dp
      where dp.id = v_uid and dp.is_verified = true
    ) then
      raise exception 'Doctor must remain verified to modify lab orders';
    end if;

    if new.clinical_note is distinct from old.clinical_note
       or new.received_at is distinct from old.received_at
       or new.completed_at is distinct from old.completed_at then
      raise exception 'Doctor cannot modify laboratory workflow fields';
    end if;

    if new.status is distinct from old.status then
      if new.status <> 'cancelled' or old.status in ('completed','cancelled') then
        raise exception 'Doctor can only cancel an order before completion';
      end if;
      if new.cancelled_at is null then
        raise exception 'Cancellation requires cancelled_at';
      end if;
    elsif new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'cancelled_at can only change with cancellation';
    end if;

    return new;
  end if;

  if old.laboratory_branch_id is not null
     and public.is_laboratory_branch_member(old.laboratory_branch_id, v_uid) then
    if new.clinical_note is distinct from old.clinical_note then
      raise exception 'Laboratory cannot modify clinical_note';
    end if;

    if new.status is not distinct from old.status then
      if new.received_at is distinct from old.received_at
         or new.completed_at is distinct from old.completed_at
         or new.cancelled_at is distinct from old.cancelled_at then
        raise exception 'Workflow timestamps can only change with a valid status transition';
      end if;
      return new;
    end if;

    if old.status = 'pending' and new.status = 'received_by_lab' then
      if new.received_at is null or new.completed_at is not null or new.cancelled_at is not null then
        raise exception 'Receiving an order requires received_at and no terminal timestamps';
      end if;
      return new;
    end if;

    if old.status = 'received_by_lab' and new.status = 'in_progress' then
      if old.received_at is null or new.received_at is null
         or new.completed_at is not null or new.cancelled_at is not null then
        raise exception 'Starting work requires a received order and received_at';
      end if;
      return new;
    end if;

    if old.status = 'in_progress' and new.status = 'completed' then
      if new.received_at is null or new.completed_at is null or new.cancelled_at is not null then
        raise exception 'Completing an order requires received_at and completed_at';
      end if;
      if not exists (
        select 1
        from public.diagnostic_reports dr
        where dr.lab_order_id = new.id
          and dr.status = 'final'
          and (
            dr.laboratory_id = v_uid
            or (old.laboratory_branch_id is not null
                and public.is_laboratory_branch_member(old.laboratory_branch_id, dr.laboratory_id))
          )
      ) then
        raise exception 'Order cannot be completed without a final diagnostic report for this branch';
      end if;
      return new;
    end if;

    if new.status = 'cancelled' and old.status in ('pending','received_by_lab','in_progress') then
      if new.cancelled_at is null or new.completed_at is not null then
        raise exception 'Cancellation requires cancelled_at and cannot have completed_at';
      end if;
      return new;
    end if;

    raise exception 'Invalid lab order status transition: % -> %', old.status, new.status;
  end if;

  -- Backward compatibility for historical operational orders without a branch.
  if old.laboratory_branch_id is null and v_uid = old.laboratory_id then
    if new.clinical_note is distinct from old.clinical_note then
      raise exception 'Laboratory cannot modify clinical_note';
    end if;
    if new.status is not distinct from old.status then
      if new.received_at is distinct from old.received_at
         or new.completed_at is distinct from old.completed_at
         or new.cancelled_at is distinct from old.cancelled_at then
        raise exception 'Workflow timestamps can only change with a valid status transition';
      end if;
      return new;
    end if;
    if old.status = 'pending' and new.status = 'received_by_lab' and new.received_at is not null then
      return new;
    end if;
    if old.status = 'received_by_lab' and new.status = 'in_progress' and old.received_at is not null then
      return new;
    end if;
    if old.status = 'in_progress' and new.status = 'completed' then
      if new.completed_at is null or new.received_at is null then
        raise exception 'Completion requires workflow timestamps';
      end if;
      if not exists (
        select 1 from public.diagnostic_reports dr
        where dr.lab_order_id = new.id and dr.laboratory_id = v_uid and dr.status = 'final'
      ) then
        raise exception 'Order cannot be completed without a final diagnostic report';
      end if;
      return new;
    end if;
    if new.status = 'cancelled' and old.status in ('pending','received_by_lab','in_progress') and new.cancelled_at is not null then
      return new;
    end if;
    raise exception 'Invalid lab order status transition: % -> %', old.status, new.status;
  end if;

  raise exception 'User is not authorized for this lab order';
end;
$function$;

revoke all on function "public"."guard_lab_order"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_lab_order"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_follow_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  if tg_op = 'INSERT' then
    if new.doctor_id <> v_uid then
      raise exception 'Follow-up doctor must equal current user';
    end if;
    if not exists (
      select 1
      from public.profiles p
      join public.doctor_profiles dp on dp.id=p.id
      where p.id=v_uid
        and p.role='doctor'::public.user_role
        and dp.is_verified=true
    ) then
      raise exception 'Doctor must be verified';
    end if;
    if not exists (
      select 1
      from public.patient_doctor_relationships pdr
      where pdr.doctor_id=v_uid
        and pdr.patient_id=new.patient_id
        and pdr.status='active'
    ) then
      raise exception 'Doctor has no active relationship with patient';
    end if;
    if new.status <> 'pending' then
      raise exception 'New follow-ups must start as pending';
    end if;

    new.created_at := now();
    new.completed_at := null;
    new.cancelled_at := null;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Follow-up identity and creation timestamp are immutable';
  end if;

  if old.doctor_id is distinct from v_uid then
    raise exception 'Only the owning doctor can modify a follow-up';
  end if;
  if not exists (
    select 1
    from public.profiles p
    join public.doctor_profiles dp on dp.id=p.id
    where p.id=v_uid
      and p.role='doctor'::public.user_role
      and dp.is_verified=true
  ) then
    raise exception 'Doctor must be verified';
  end if;
  if not exists (
    select 1
    from public.patient_doctor_relationships pdr
    where pdr.doctor_id=v_uid
      and pdr.patient_id=new.patient_id
      and pdr.status='active'
  ) then
    raise exception 'Doctor has no active relationship with patient';
  end if;

  if old.status in ('completed','cancelled') and new.status is distinct from old.status then
    raise exception 'Completed or cancelled follow-up cannot change status';
  end if;

  if new.status = 'completed' then
    if old.status = 'completed' then
      new.completed_at := coalesce(old.completed_at, now());
    else
      if old.status not in ('pending','overdue') then
        raise exception 'Invalid follow-up status transition';
      end if;
      new.completed_at := now();
    end if;
    new.cancelled_at := null;

  elsif new.status = 'cancelled' then
    if old.status = 'cancelled' then
      new.cancelled_at := coalesce(old.cancelled_at, now());
    else
      if old.status not in ('pending','overdue') then
        raise exception 'Invalid follow-up status transition';
      end if;
      new.cancelled_at := now();
    end if;
    new.completed_at := null;

  elsif new.status in ('pending','overdue') then
    if old.status not in ('pending','overdue') then
      raise exception 'Invalid follow-up status transition';
    end if;
    new.completed_at := null;
    new.cancelled_at := null;

  else
    raise exception 'Invalid follow-up status';
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_follow_up"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_follow_up"() to "postgres";

CREATE OR REPLACE FUNCTION public.get_my_login_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'full_name', p.full_name,
    'phone', p.phone,
    'national_id', p.national_id,
    'avatar_url', p.avatar_url,
    'doctor_profiles',
      case
        when dp.id is null then 'null'::jsonb
        else jsonb_build_object(
          'medical_license_number', dp.medical_license_number,
          'is_verified', dp.is_verified,
          'specialty', dp.specialty
        )
      end,
    'laboratory_profiles',
      case
        when lp.id is null then 'null'::jsonb
        else jsonb_build_object(
          'license_number', lp.license_number,
          'organization_id', lp.organization_id
        )
      end,
    'has_patient_profile', exists (
      select 1
      from public.patient_profiles pp
      where pp.id = uid
    )
  )
  into result
  from public.profiles p
  left join public.doctor_profiles dp on dp.id = p.id
  left join public.laboratory_profiles lp on lp.id = p.id
  where p.id = uid;

  return result;
end;
$function$;

revoke all on function "public"."get_my_login_profile"() from public,anon,authenticated,service_role;

grant execute on function "public"."get_my_login_profile"() to "postgres";

CREATE OR REPLACE FUNCTION public.notify_new_lab_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_doctor_id uuid;
begin
  if new.status not in ('final','amended') then
    return new;
  end if;

  select doctor_id into v_doctor_id
  from public.lab_orders
  where id = new.lab_order_id;

  if v_doctor_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.notifications
    where recipient_id = v_doctor_id
      and type = 'new_result'
      and related_entity_type = 'diagnostic_report'
      and related_entity_id = new.id
  ) then
    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      status,
      is_read
    )
    values (
      v_doctor_id,
      'new_result',
      'نتیجه آزمایش جدید',
      'یک نتیجه آزمایش برای بررسی شما آماده است.',
      'diagnostic_report',
      new.id,
      'unread',
      false
    );
  end if;

  return new;
end;
$function$;

revoke all on function "public"."notify_new_lab_result"() from public,anon,authenticated,service_role;

grant execute on function "public"."notify_new_lab_result"() to "postgres";

CREATE OR REPLACE FUNCTION public.notify_completed_lab_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if new.status <> 'completed'
     or old.status = 'completed' then
    return new;
  end if;

  if not exists (
    select 1
    from public.notifications
    where recipient_id = new.doctor_id
      and type = 'requested_test_completed'
      and related_entity_type = 'lab_order'
      and related_entity_id = new.id
  ) then
    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      status,
      is_read
    )
    values (
      new.doctor_id,
      'requested_test_completed',
      'آزمایش تکمیل شد',
      'آزمایش درخواست‌شده تکمیل شده و آماده بررسی است.',
      'lab_order',
      new.id,
      'unread',
      false
    );
  end if;

  return new;
end;
$function$;

revoke all on function "public"."notify_completed_lab_order"() from public,anon,authenticated,service_role;

grant execute on function "public"."notify_completed_lab_order"() to "postgres";

CREATE OR REPLACE FUNCTION public.notify_follow_up_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1
    from public.notifications
    where recipient_id = new.patient_id
      and type = 'patient_action_required'
      and related_entity_type = 'follow_up'
      and related_entity_id = new.id
  ) then
    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      status,
      is_read
    )
    values (
      new.patient_id,
      'patient_action_required',
      'پیگیری جدید',
      new.title,
      'follow_up',
      new.id,
      'unread',
      false
    );
  end if;

  return new;
end;
$function$;

revoke all on function "public"."notify_follow_up_created"() from public,anon,authenticated,service_role;

grant execute on function "public"."notify_follow_up_created"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_diagnostic_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
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

revoke all on function "public"."guard_diagnostic_report"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_diagnostic_report"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_lab_dispatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid;
  v_doctor_id uuid;
  v_request_status text;
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  if tg_op = 'INSERT' then
    select r.patient_id, r.doctor_id, r.status
    into v_patient_id, v_doctor_id, v_request_status
    from public.physician_lab_requests r
    where r.id = new.physician_lab_request_id;

    if v_patient_id is distinct from v_uid or new.created_by is distinct from v_uid then
      raise exception 'Only the patient who owns this request can submit it to a laboratory';
    end if;
    if v_request_status <> 'submitted' then raise exception 'Physician request is not active'; end if;
    if new.status <> 'pending' then raise exception 'New laboratory dispatch must start as pending'; end if;

    if not exists (
      select 1 from public.laboratory_branches b
      join public.organizations o on o.id=b.organization_id
      where b.id=new.laboratory_branch_id and b.is_active=true and o.type='laboratory'
        and (not new.requested_home_collection or b.supports_home_collection=true)
    ) then
      raise exception 'Destination branch is inactive or does not support the requested collection type';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.physician_lab_request_id is distinct from old.physician_lab_request_id
     or new.laboratory_branch_id is distinct from old.laboratory_branch_id
     or new.created_by is distinct from old.created_by
     or new.sent_at is distinct from old.sent_at
     or new.created_at is distinct from old.created_at
     or new.requested_home_collection is distinct from old.requested_home_collection then
    raise exception 'Dispatch identity and collection choice are immutable';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('accepted','rejected','cancelled') then
      raise exception 'Invalid dispatch status transition';
    end if;

    if new.status in ('accepted','rejected') then
      if not public.is_laboratory_branch_member(old.laboratory_branch_id, v_uid) then
        raise exception 'Only an authorized destination branch member can respond';
      end if;
      if new.responded_by is distinct from v_uid or new.responded_at is null then
        raise exception 'A laboratory response must record the current responder and timestamp';
      end if;
    elsif new.status = 'cancelled' then
      select r.patient_id, r.doctor_id into v_patient_id, v_doctor_id
      from public.physician_lab_requests r where r.id=old.physician_lab_request_id;
      if v_uid not in (v_patient_id, v_doctor_id) then
        raise exception 'Only the patient or requesting doctor can cancel a pending submission';
      end if;
    end if;
  elsif new.lab_order_id is distinct from old.lab_order_id then
    if old.status <> 'accepted'
       or old.responded_by is distinct from v_uid
       or old.lab_order_id is not null
       or new.lab_order_id is null then
      raise exception 'Operational order link is immutable';
    end if;
  elsif new.responded_by is distinct from old.responded_by
     or new.responded_at is distinct from old.responded_at
     or new.response_note is distinct from old.response_note then
    raise exception 'Dispatch response fields can only change with a valid response';
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_lab_dispatch"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_lab_dispatch"() to "postgres";

CREATE OR REPLACE FUNCTION public.audit_lab_order_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_action text;
begin
  if v_uid is null or old.status is not distinct from new.status then return new; end if;
  v_action := case new.status::text
    when 'received_by_lab' then 'lab_order_received'
    when 'in_progress' then 'lab_order_started'
    when 'completed' then 'lab_order_completed'
    when 'cancelled' then 'lab_order_cancelled'
    else null
  end;
  if v_action is not null then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,v_action,'lab_order',new.id,jsonb_build_object(
      'previous_status',old.status::text,'new_status',new.status::text,
      'laboratory_id',new.laboratory_id,'doctor_id',new.doctor_id,'patient_id',new.patient_id));
  end if;
  return new;
end;
$function$;

revoke all on function "public"."audit_lab_order_event"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_lab_order_event"() to "postgres";

CREATE OR REPLACE FUNCTION public.audit_diagnostic_report_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_action text;
begin
  if v_uid is null then return new; end if;
  v_action := case
    when old.status='draft' and new.status='final' then 'report_finalized'
    when old.status='final' and new.status='amended' then 'report_amended'
    else null end;
  if v_action is not null then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,v_action,'diagnostic_report',new.id,jsonb_build_object(
      'previous_status',old.status::text,'new_status',new.status::text,
      'lab_order_id',new.lab_order_id,'laboratory_id',new.laboratory_id,
      'finalized_by',new.finalized_by,'finalized_at',new.finalized_at));
  end if;
  return new;
end;
$function$;

revoke all on function "public"."audit_diagnostic_report_event"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_diagnostic_report_event"() to "postgres";

CREATE OR REPLACE FUNCTION public.audit_observation_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_action text;
begin
  if v_uid is null then return new; end if;
  if tg_op='INSERT' then
    v_action := case new.status::text when 'preliminary' then 'result_created' when 'corrected' then 'result_corrected' else null end;
    if v_action is not null then
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(v_uid,v_action,'observation',new.id,jsonb_build_object(
        'diagnostic_report_id',new.diagnostic_report_id,'test_definition_id',new.test_definition_id,
        'status',new.status::text,'entered_by',new.entered_by,
        'supersedes_observation_id',new.supersedes_observation_id));
    end if;
    return new;
  end if;
  if old.status is distinct from new.status and new.status='superseded' then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,'result_updated','observation',new.id,jsonb_build_object(
      'previous_status',old.status::text,'new_status',new.status::text,
      'diagnostic_report_id',new.diagnostic_report_id,'test_definition_id',new.test_definition_id));
  end if;
  return new;
end;
$function$;

revoke all on function "public"."audit_observation_event"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_observation_event"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_home_collection_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.lab_dispatches d
      join public.physician_lab_requests r on r.id=d.physician_lab_request_id
      join public.laboratory_branches b on b.id=d.laboratory_branch_id
      where d.id=new.lab_dispatch_id
        and d.physician_lab_request_id=new.physician_lab_request_id
        and d.laboratory_branch_id=new.laboratory_branch_id
        and d.requested_home_collection=true
        and r.patient_id=new.patient_id
        and r.doctor_id=new.doctor_id
        and b.supports_home_collection=true
    ) then raise exception 'Home collection does not match an eligible patient dispatch and destination branch'; end if;
    if new.status <> 'requested' then raise exception 'New home collection request must start as requested'; end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.physician_lab_request_id is distinct from old.physician_lab_request_id
     or new.lab_dispatch_id is distinct from old.lab_dispatch_id
     or new.laboratory_branch_id is distinct from old.laboratory_branch_id
     or new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id
     or new.requested_at is distinct from old.requested_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Home collection request identity is immutable';
  end if;

  if new.status is distinct from old.status then
    if old.status='requested' and new.status in ('approved','rejected') then
      if not public.is_laboratory_branch_member(old.laboratory_branch_id,v_uid) then
        raise exception 'Only the destination laboratory can approve or reject home collection';
      end if;
      if new.status='approved' and not exists (
        select 1 from public.lab_dispatches d
        where d.id=old.lab_dispatch_id and d.status='accepted' and d.lab_order_id is not null
      ) then
        raise exception 'Home collection can only be approved after the laboratory accepts the order';
      end if;
      if new.status='approved' and new.approved_at is null then raise exception 'Approval requires approved_at'; end if;
      if new.status='rejected' and new.rejected_at is null then raise exception 'Rejection requires rejected_at'; end if;
    elsif old.status='approved' and new.status='scheduled' then
      if not public.is_laboratory_branch_member(old.laboratory_branch_id,v_uid)
         or new.scheduled_for is null or new.collector_profile_id is null then
        raise exception 'Scheduling requires an authorized branch member, schedule time and collector';
      end if;
      if not exists (
        select 1 from public.laboratory_branch_members lbm
        where lbm.branch_id=old.laboratory_branch_id
          and lbm.profile_id=new.collector_profile_id and lbm.is_active=true
      ) then raise exception 'Collector must be an authorized member of the destination branch'; end if;
    elsif old.status='scheduled' and new.status='dispatched' then
      if not public.is_laboratory_branch_member(old.laboratory_branch_id,v_uid) or new.dispatched_at is null then
        raise exception 'Dispatching a collector requires authorization and dispatched_at';
      end if;
    elsif old.status='dispatched' and new.status='collected' then
      if not public.is_laboratory_branch_member(old.laboratory_branch_id,v_uid) or new.collected_at is null then
        raise exception 'Collection requires an authorized destination branch member and collected_at';
      end if;
    elsif new.status='cancelled' and old.status in ('requested','approved','scheduled') then
      if v_uid not in (old.patient_id,old.doctor_id)
         and not public.is_laboratory_branch_member(old.laboratory_branch_id,v_uid) then
        raise exception 'Not authorized to cancel home collection';
      end if;
      if new.cancelled_at is null then raise exception 'Cancellation requires cancelled_at'; end if;
    else
      raise exception 'Invalid home collection status transition: % -> %',old.status,new.status;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_home_collection_request"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_home_collection_request"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_lab_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if public.is_service_role() then
    return new;
  end if;

  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    if new.doctor_id is distinct from v_uid
       or new.created_by is distinct from v_uid then
      raise exception 'Physician request must be created by current doctor';
    end if;

    if not exists (
      select 1 from public.doctor_profiles dp
      where dp.id = v_uid and dp.is_verified = true
    ) then
      raise exception 'Verified doctor required';
    end if;

    if not exists (
      select 1 from public.patient_doctor_relationships pdr
      where pdr.patient_id = new.patient_id
        and pdr.doctor_id = v_uid
        and pdr.status = 'active'
    ) then
      raise exception 'Active patient relationship required';
    end if;

    return new;
  end if;

  if new.id is distinct from old.id
     or new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.clinical_note is distinct from old.clinical_note
     or new.requested_home_collection is distinct from old.requested_home_collection then
    raise exception 'Physician request identity and contents are immutable';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if v_uid <> old.doctor_id then
        raise exception 'Only the requesting doctor can cancel the request';
      end if;
      if exists (
        select 1 from public.lab_dispatches d
        where d.physician_lab_request_id = old.id
          and d.status = 'accepted'
      ) then
        raise exception 'Request cannot be cancelled after laboratory acceptance';
      end if;
      if new.cancelled_at is null then
        raise exception 'Cancellation requires cancelled_at';
      end if;
    elsif new.status = 'fulfilled' then
      if not exists (
        select 1 from public.lab_orders lo
        where lo.physician_lab_request_id = old.id
          and lo.status = 'completed'
      ) then
        raise exception 'Request can be fulfilled only after an operational order completes';
      end if;
      if new.fulfilled_at is null then
        raise exception 'Fulfilled request requires fulfilled_at';
      end if;
    else
      raise exception 'Invalid physician request status transition';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_lab_request"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_lab_request"() to "postgres";

CREATE OR REPLACE FUNCTION public.audit_patient_notification_read()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if public.is_service_role() then
    return new;
  end if;

  if old.is_read = false
     and new.is_read = true
     and new.recipient_id = auth.uid()
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid()
         and p.role = 'patient'::user_role
     ) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'notification_read', 'notification', new.id, null);
  end if;

  return new;
end;
$function$;

revoke all on function "public"."audit_patient_notification_read"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_patient_notification_read"() to "postgres";

CREATE OR REPLACE FUNCTION public.log_lab_workflow_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_id uuid;
  v_patient_id uuid;
  v_doctor_id uuid;
  v_branch_id uuid;
  v_request_id uuid;
  v_dispatch_id uuid;
  v_order_id uuid;
  v_home_id uuid;
  v_old_status text;
  v_new_status text;
  v_event_type text;
  v_entity_type text;
begin
  v_id := nullif(v_new->>'id','')::uuid;
  v_old_status := v_old->>'status';
  v_new_status := v_new->>'status';

  if tg_op = 'UPDATE' and v_old_status is not distinct from v_new_status then
    return new;
  end if;

  v_event_type := lower(tg_table_name) || '.' || lower(tg_op);
  if v_old_status is not null or v_new_status is not null then
    v_event_type := v_event_type || ':' || coalesce(v_old_status, 'none') || '->' || coalesce(v_new_status, 'none');
  end if;

  case tg_table_name
    when 'physician_lab_requests' then
      v_entity_type := 'physician_lab_request';
      v_request_id := v_id;
      v_patient_id := nullif(v_new->>'patient_id','')::uuid;
      v_doctor_id := nullif(v_new->>'doctor_id','')::uuid;

    when 'lab_dispatches' then
      v_entity_type := 'lab_dispatch';
      v_dispatch_id := v_id;
      v_request_id := nullif(v_new->>'physician_lab_request_id','')::uuid;
      v_branch_id := nullif(v_new->>'laboratory_branch_id','')::uuid;
      v_order_id := nullif(v_new->>'lab_order_id','')::uuid;
      select r.patient_id, r.doctor_id into v_patient_id, v_doctor_id
      from public.physician_lab_requests r where r.id = v_request_id;

    when 'home_collection_requests' then
      v_entity_type := 'home_collection_request';
      v_home_id := v_id;
      v_request_id := nullif(v_new->>'physician_lab_request_id','')::uuid;
      v_dispatch_id := nullif(v_new->>'lab_dispatch_id','')::uuid;
      v_branch_id := nullif(v_new->>'laboratory_branch_id','')::uuid;
      v_order_id := nullif(v_new->>'lab_order_id','')::uuid;
      v_patient_id := nullif(v_new->>'patient_id','')::uuid;
      v_doctor_id := nullif(v_new->>'doctor_id','')::uuid;

    when 'lab_orders' then
      v_entity_type := 'lab_order';
      v_order_id := v_id;
      v_patient_id := nullif(v_new->>'patient_id','')::uuid;
      v_doctor_id := nullif(v_new->>'doctor_id','')::uuid;
      v_branch_id := nullif(v_new->>'laboratory_branch_id','')::uuid;
      v_request_id := nullif(v_new->>'physician_lab_request_id','')::uuid;
      v_dispatch_id := nullif(v_new->>'lab_dispatch_id','')::uuid;

    when 'home_collection_private_details' then
      v_entity_type := 'home_collection_private_details';
      v_home_id := nullif(v_new->>'home_collection_request_id','')::uuid;
      v_id := v_home_id;
      select h.patient_id, h.doctor_id, h.laboratory_branch_id,
             h.physician_lab_request_id, h.lab_dispatch_id, h.lab_order_id
      into v_patient_id, v_doctor_id, v_branch_id, v_request_id, v_dispatch_id, v_order_id
      from public.home_collection_requests h
      where h.id = v_home_id;

    else
      v_entity_type := tg_table_name;
  end case;

  insert into public.lab_workflow_events (
    actor_id, event_type, entity_type, entity_id, patient_id, doctor_id,
    laboratory_branch_id, physician_lab_request_id, lab_dispatch_id,
    lab_order_id, home_collection_request_id, metadata
  )
  values (
    auth.uid(),
    v_event_type,
    v_entity_type,
    coalesce(v_id, v_order_id, v_dispatch_id, v_home_id, v_request_id),
    v_patient_id,
    v_doctor_id,
    v_branch_id,
    v_request_id,
    v_dispatch_id,
    v_order_id,
    v_home_id,
    jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'old_status', v_old_status,
      'new_status', v_new_status
    )
  );

  return new;
end;
$function$;

revoke all on function "public"."log_lab_workflow_mutation"() from public,anon,authenticated,service_role;

grant execute on function "public"."log_lab_workflow_mutation"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_guest_result_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid();
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from v_uid then raise exception 'created_by must equal current user'; end if;
    if not exists (
      select 1 from public.diagnostic_reports dr
      where dr.id = new.diagnostic_report_id
        and dr.laboratory_id = v_uid
        and dr.status in ('final','amended')
    ) then
      raise exception 'Guest access must target a laboratory-owned final report';
    end if;
    if new.token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest access token hash'; end if;
    if new.expires_at <= now() then raise exception 'Guest access must expire in the future'; end if;
    if new.access_count <> 0 or new.last_accessed_at is not null or new.revoked_at is not null then
      raise exception 'Guest access counters are server managed';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.diagnostic_report_id is distinct from old.diagnostic_report_id
     or new.token_hash is distinct from old.token_hash
     or new.expires_at is distinct from old.expires_at
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Guest access identity is immutable';
  end if;

  if new.access_count is distinct from old.access_count
     or new.last_accessed_at is distinct from old.last_accessed_at
  then
    raise exception 'Guest access counters are server managed';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'Revoked guest access cannot be reactivated';
  end if;

  if v_uid is null or not exists (
    select 1 from public.diagnostic_reports dr
    where dr.id = new.diagnostic_report_id and dr.laboratory_id = v_uid
  ) then
    raise exception 'Only owning laboratory can revoke guest access';
  end if;

  if old.revoked_at is null and new.revoked_at is null then
    raise exception 'Guest access update must revoke access';
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_guest_result_access"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_guest_result_access"() to "postgres";

CREATE OR REPLACE FUNCTION public.audit_guest_result_access_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(),'guest_result_access_created','diagnostic_report',new.diagnostic_report_id,
      jsonb_build_object('guest_access_id',new.id,'expires_at',new.expires_at));
  elsif tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(),'guest_result_access_revoked','diagnostic_report',new.diagnostic_report_id,
      jsonb_build_object('guest_access_id',new.id));
  end if;
  return new;
end;
$function$;

revoke all on function "public"."audit_guest_result_access_event"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_guest_result_access_event"() to "postgres";

CREATE OR REPLACE FUNCTION public.is_laboratory_branch_member(p_branch_id uuid, p_profile_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  select p_profile_id is not distinct from auth.uid()
    and exists (
      select 1
      from public.laboratory_branch_members lbm
      where lbm.branch_id=p_branch_id
        and lbm.profile_id=auth.uid()
        and lbm.is_active=true
    );
$function$;

revoke all on function "public"."is_laboratory_branch_member"(p_branch_id uuid, p_profile_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."is_laboratory_branch_member"(p_branch_id uuid, p_profile_id uuid) to "postgres";

grant execute on function "public"."is_laboratory_branch_member"(p_branch_id uuid, p_profile_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.update_own_profile(p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_patient_exists boolean;
  v_date date;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'Invalid input'; end if;

  if exists (
    select 1 from jsonb_object_keys(p_input) as key_name
    where key_name not in (
      'full_name', 'avatar_url', 'date_of_birth', 'sex', 'blood_type',
      'emergency_contact_name', 'emergency_contact_phone'
    )
  ) then raise exception 'Invalid input'; end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_uid;

  if v_role is null then raise exception 'Profile not found'; end if;

  if p_input ? 'full_name' then
    if jsonb_typeof(p_input->'full_name') <> 'string'
       or btrim(p_input->>'full_name') = ''
       or char_length(btrim(p_input->>'full_name')) > 150
    then raise exception 'Invalid full_name'; end if;

    update public.profiles
    set full_name = btrim(p_input->>'full_name')
    where id = v_uid;
  end if;

  if p_input ? 'avatar_url' then
    if jsonb_typeof(p_input->'avatar_url') not in ('string','null')
       or (
         jsonb_typeof(p_input->'avatar_url')='string'
         and char_length(btrim(p_input->>'avatar_url')) > 2048
       )
    then raise exception 'Invalid avatar_url'; end if;

    update public.profiles
    set avatar_url = nullif(btrim(p_input->>'avatar_url'),'')
    where id = v_uid;
  end if;

  if v_role <> 'patient' and (
    p_input ? 'date_of_birth'
    or p_input ? 'sex'
    or p_input ? 'blood_type'
    or p_input ? 'emergency_contact_name'
    or p_input ? 'emergency_contact_phone'
  ) then
    raise exception 'Patient fields require patient role';
  end if;

  if v_role = 'patient' then
    if p_input ? 'date_of_birth' then
      if jsonb_typeof(p_input->'date_of_birth') <> 'string'
         or (p_input->>'date_of_birth') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then raise exception 'Invalid date_of_birth'; end if;

      begin
        v_date := (p_input->>'date_of_birth')::date;
      exception when others then
        raise exception 'Invalid date_of_birth';
      end;

      if v_date > current_date then
        raise exception 'Invalid date_of_birth';
      end if;
    end if;

    if p_input ? 'sex'
       and (
         jsonb_typeof(p_input->'sex') <> 'string'
         or p_input->>'sex' not in ('male','female')
       )
    then raise exception 'Invalid sex'; end if;

    if p_input ? 'blood_type'
       and jsonb_typeof(p_input->'blood_type') not in ('string','null')
    then raise exception 'Invalid blood_type'; end if;

    if p_input ? 'blood_type'
       and jsonb_typeof(p_input->'blood_type')='string'
       and char_length(btrim(p_input->>'blood_type')) > 30
    then raise exception 'Invalid blood_type'; end if;

    if p_input ? 'emergency_contact_name'
       and jsonb_typeof(p_input->'emergency_contact_name') not in ('string','null')
    then raise exception 'Invalid emergency_contact_name'; end if;

    if p_input ? 'emergency_contact_name'
       and jsonb_typeof(p_input->'emergency_contact_name')='string'
       and char_length(btrim(p_input->>'emergency_contact_name')) > 150
    then raise exception 'Invalid emergency_contact_name'; end if;

    if p_input ? 'emergency_contact_phone'
       and jsonb_typeof(p_input->'emergency_contact_phone') not in ('string','null')
    then raise exception 'Invalid emergency_contact_phone'; end if;

    if p_input ? 'emergency_contact_phone'
       and jsonb_typeof(p_input->'emergency_contact_phone')='string'
       and btrim(p_input->>'emergency_contact_phone') <> ''
       and btrim(p_input->>'emergency_contact_phone') !~ '^\+[1-9][0-9]{7,14}$'
    then raise exception 'Invalid emergency_contact_phone'; end if;

    select exists(
      select 1 from public.patient_profiles pp where pp.id = v_uid
    ) into v_patient_exists;

    if not v_patient_exists then
      if not (p_input ? 'date_of_birth') or not (p_input ? 'sex') then
        raise exception 'Patient profile requires date_of_birth and sex';
      end if;

      insert into public.patient_profiles (
        id, date_of_birth, sex, blood_type, emergency_contact_name, emergency_contact_phone
      ) values (
        v_uid,
        v_date,
        p_input->>'sex',
        nullif(btrim(p_input->>'blood_type'),''),
        nullif(btrim(p_input->>'emergency_contact_name'),''),
        nullif(btrim(p_input->>'emergency_contact_phone'),'')
      );
    else
      if p_input ? 'date_of_birth' then
        update public.patient_profiles set date_of_birth = v_date where id = v_uid;
      end if;
      if p_input ? 'sex' then
        update public.patient_profiles set sex = p_input->>'sex' where id = v_uid;
      end if;
      if p_input ? 'blood_type' then
        update public.patient_profiles set blood_type = nullif(btrim(p_input->>'blood_type'),'') where id = v_uid;
      end if;
      if p_input ? 'emergency_contact_name' then
        update public.patient_profiles set emergency_contact_name = nullif(btrim(p_input->>'emergency_contact_name'),'') where id = v_uid;
      end if;
      if p_input ? 'emergency_contact_phone' then
        update public.patient_profiles set emergency_contact_phone = nullif(btrim(p_input->>'emergency_contact_phone'),'') where id = v_uid;
      end if;
    end if;
  end if;
end;
$function$;

revoke all on function "public"."update_own_profile"(p_input jsonb) from public,anon,authenticated,service_role;

grant execute on function "public"."update_own_profile"(p_input jsonb) to "postgres";

grant execute on function "public"."update_own_profile"(p_input jsonb) to "authenticated";

CREATE OR REPLACE FUNCTION public.sync_lab_request_from_completed_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if new.status='completed'
     and old.status is distinct from new.status
     and new.physician_lab_request_id is not null then
    update public.physician_lab_requests
    set status='fulfilled', fulfilled_at=coalesce(fulfilled_at,now())
    where id=new.physician_lab_request_id and status='submitted';
  end if;
  return new;
end;
$function$;

revoke all on function "public"."sync_lab_request_from_completed_order"() from public,anon,authenticated,service_role;

grant execute on function "public"."sync_lab_request_from_completed_order"() to "postgres";

CREATE OR REPLACE FUNCTION public.dispatch_request_to_another_lab(p_request_id uuid, p_laboratory_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_request public.physician_lab_requests%rowtype;
  v_branch public.laboratory_branches%rowtype;
  v_dispatch_id uuid;
  v_home_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_request
  from public.physician_lab_requests r
  where r.id=p_request_id and r.doctor_id=v_uid
  for update;
  if not found then raise exception 'Physician request not found'; end if;
  if v_request.status <> 'submitted' then raise exception 'Request is not open for dispatch'; end if;

  if exists (
    select 1 from public.lab_dispatches d
    where d.physician_lab_request_id=p_request_id
      and d.status in ('pending','accepted')
  ) then raise exception 'A pending or accepted dispatch already exists'; end if;

  select * into v_branch from public.laboratory_branches b
  where b.id=p_laboratory_branch_id and b.is_active=true;
  if not found then raise exception 'Active laboratory branch not found'; end if;

  if v_request.requested_home_collection and not v_branch.supports_home_collection then
    raise exception 'Selected branch does not support home collection'; end if;

  insert into public.lab_dispatches (
    physician_lab_request_id, laboratory_branch_id, created_by, status
  ) values (p_request_id, p_laboratory_branch_id, v_uid, 'pending')
  returning id into v_dispatch_id;

  if v_request.requested_home_collection then
    insert into public.home_collection_requests (
      physician_lab_request_id, lab_dispatch_id, laboratory_branch_id,
      patient_id, doctor_id, status
    ) values (
      p_request_id, v_dispatch_id, p_laboratory_branch_id,
      v_request.patient_id, v_request.doctor_id, 'requested'
    ) returning id into v_home_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'dispatch_id', v_dispatch_id,
    'home_collection_request_id', v_home_id,
    'laboratory_branch_id', p_laboratory_branch_id,
    'status', 'pending'
  );
end;
$function$;

revoke all on function "public"."dispatch_request_to_another_lab"(p_request_id uuid, p_laboratory_branch_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."dispatch_request_to_another_lab"(p_request_id uuid, p_laboratory_branch_id uuid) to "postgres";

grant execute on function "public"."dispatch_request_to_another_lab"(p_request_id uuid, p_laboratory_branch_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.accept_lab_dispatch(p_dispatch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dispatch public.lab_dispatches%rowtype;
  v_request public.physician_lab_requests%rowtype;
  v_order_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_dispatch
  from public.lab_dispatches d
  where d.id=p_dispatch_id
  for update;
  if not found then raise exception 'Dispatch not found'; end if;

  if not public.is_laboratory_branch_member(v_dispatch.laboratory_branch_id, v_uid) then
    raise exception 'Only an authorized destination branch member can accept this dispatch'; end if;

  if v_dispatch.status = 'accepted' and v_dispatch.lab_order_id is not null then
    return jsonb_build_object(
      'ok', true,
      'dispatch_id', v_dispatch.id,
      'lab_order_id', v_dispatch.lab_order_id,
      'status', 'accepted',
      'idempotent', true
    );
  end if;

  if v_dispatch.status <> 'pending' then
    raise exception 'Only a pending dispatch can be accepted'; end if;

  select * into v_request
  from public.physician_lab_requests r
  where r.id=v_dispatch.physician_lab_request_id
  for update;
  if not found or v_request.status <> 'submitted' then
    raise exception 'Physician request is not active'; end if;

  update public.lab_dispatches
  set status='accepted', responded_at=now(), responded_by=v_uid, response_note=null
  where id=v_dispatch.id;

  insert into public.lab_orders (
    patient_id, doctor_id, laboratory_id, laboratory_branch_id,
    physician_lab_request_id, lab_dispatch_id, status, clinical_note
  ) values (
    v_request.patient_id, v_request.doctor_id, v_uid, v_dispatch.laboratory_branch_id,
    v_request.id, v_dispatch.id, 'pending', v_request.clinical_note
  ) returning id into v_order_id;

  insert into public.lab_order_items (lab_order_id, test_panel_id, test_definition_id)
  select v_order_id, ri.test_panel_id, ri.test_definition_id
  from public.physician_lab_request_items ri
  where ri.physician_lab_request_id = v_request.id;

  update public.lab_dispatches
  set lab_order_id=v_order_id
  where id=v_dispatch.id;

  update public.home_collection_requests
  set lab_order_id=v_order_id
  where lab_dispatch_id=v_dispatch.id;

  return jsonb_build_object(
    'ok', true,
    'dispatch_id', v_dispatch.id,
    'lab_order_id', v_order_id,
    'status', 'accepted',
    'idempotent', false
  );
end;
$function$;

revoke all on function "public"."accept_lab_dispatch"(p_dispatch_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."accept_lab_dispatch"(p_dispatch_id uuid) to "postgres";

grant execute on function "public"."accept_lab_dispatch"(p_dispatch_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.reject_lab_dispatch(p_dispatch_id uuid, p_response_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dispatch public.lab_dispatches%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_dispatch from public.lab_dispatches d
  where d.id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if not public.is_laboratory_branch_member(v_dispatch.laboratory_branch_id, v_uid) then
    raise exception 'Only an authorized destination branch member can reject this dispatch'; end if;

  if v_dispatch.status = 'rejected' then
    return jsonb_build_object('ok', true, 'dispatch_id', v_dispatch.id, 'status', 'rejected', 'idempotent', true);
  end if;
  if v_dispatch.status <> 'pending' then
    raise exception 'Only a pending dispatch can be rejected'; end if;

  update public.lab_dispatches
  set status='rejected', responded_at=now(), responded_by=v_uid,
      response_note=nullif(left(btrim(coalesce(p_response_note,'')),1000),'')
  where id=v_dispatch.id;

  update public.home_collection_requests
  set status='rejected', rejected_at=now(),
      rejection_reason=nullif(left(btrim(coalesce(p_response_note,'')),1000),'')
  where lab_dispatch_id=v_dispatch.id and status='requested';

  return jsonb_build_object('ok', true, 'dispatch_id', v_dispatch.id, 'status', 'rejected', 'idempotent', false);
end;
$function$;

revoke all on function "public"."reject_lab_dispatch"(p_dispatch_id uuid, p_response_note text) from public,anon,authenticated,service_role;

grant execute on function "public"."reject_lab_dispatch"(p_dispatch_id uuid, p_response_note text) to "postgres";

grant execute on function "public"."reject_lab_dispatch"(p_dispatch_id uuid, p_response_note text) to "authenticated";

CREATE OR REPLACE FUNCTION public.cancel_physician_lab_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_request public.physician_lab_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_request from public.physician_lab_requests r
  where r.id=p_request_id and r.doctor_id=v_uid for update;
  if not found then raise exception 'Physician request not found'; end if;

  if v_request.status='cancelled' then
    return jsonb_build_object('ok',true,'request_id',p_request_id,'status','cancelled','idempotent',true);
  end if;
  if v_request.status <> 'submitted' then raise exception 'Only an open request can be cancelled'; end if;
  if exists (select 1 from public.lab_dispatches d where d.physician_lab_request_id=p_request_id and d.status='accepted') then
    raise exception 'Request cannot be cancelled after laboratory acceptance';
  end if;

  update public.lab_dispatches
  set status='cancelled', response_note='Request cancelled by doctor'
  where physician_lab_request_id=p_request_id and status='pending';

  update public.home_collection_requests
  set status='cancelled', cancelled_at=now()
  where physician_lab_request_id=p_request_id and status in ('requested','approved','scheduled');

  update public.physician_lab_requests
  set status='cancelled', cancelled_at=now()
  where id=p_request_id;

  return jsonb_build_object('ok',true,'request_id',p_request_id,'status','cancelled','idempotent',false);
end;
$function$;

revoke all on function "public"."cancel_physician_lab_request"(p_request_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."cancel_physician_lab_request"(p_request_id uuid) to "postgres";

grant execute on function "public"."cancel_physician_lab_request"(p_request_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.collect_home_sample_from_qr(p_home_collection_request_id uuid, p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_home public.home_collection_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid QR token'; end if;

  select * into v_home from public.home_collection_requests h
  where h.id=p_home_collection_request_id for update;
  if not found then raise exception 'Home collection request not found'; end if;
  if not public.is_laboratory_branch_member(v_home.laboratory_branch_id, v_uid) then
    raise exception 'Only destination lab staff can record sample collection'; end if;

  if not exists (
    select 1 from public.lab_workflow_qr_tokens t
    where t.target_type='home_collection'
      and t.home_collection_request_id=v_home.id
      and t.token_hash=p_token_hash
      and t.revoked_at is null
      and t.expires_at > now()
  ) then
    raise exception 'QR token is invalid or expired for this collection request'; end if;

  if v_home.status='collected' then
    return jsonb_build_object('ok',true,'home_collection_request_id',v_home.id,'status','collected','idempotent',true);
  end if;
  if v_home.status <> 'dispatched' then
    raise exception 'Sample can only be collected after a collector has been dispatched'; end if;

  update public.home_collection_requests
  set status='collected', collected_at=now()
  where id=v_home.id;

  return jsonb_build_object('ok',true,'home_collection_request_id',v_home.id,'status','collected','idempotent',false);
end;
$function$;

revoke all on function "public"."collect_home_sample_from_qr"(p_home_collection_request_id uuid, p_token_hash text) from public,anon,authenticated,service_role;

grant execute on function "public"."collect_home_sample_from_qr"(p_home_collection_request_id uuid, p_token_hash text) to "postgres";

grant execute on function "public"."collect_home_sample_from_qr"(p_home_collection_request_id uuid, p_token_hash text) to "authenticated";

CREATE OR REPLACE FUNCTION public.submit_home_collection_private_details(p_home_collection_request_id uuid, p_city text, p_address text, p_address_line2 text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_contact_phone text DEFAULT NULL::text, p_access_instructions text DEFAULT NULL::text, p_preferred_window text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_home public.home_collection_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_home from public.home_collection_requests h
  where h.id=p_home_collection_request_id for update;
  if not found or v_home.patient_id <> v_uid then
    raise exception 'Only the patient can submit exact home location details'; end if;
  if v_home.status not in ('requested','approved') then
    raise exception 'Home address can only be submitted while collection is requested or approved'; end if;
  if length(btrim(coalesce(p_city,''))) < 2 or length(btrim(coalesce(p_address,''))) < 5 then
    raise exception 'City and exact address are required'; end if;
  if p_latitude is not null and p_latitude not between -90 and 90 then raise exception 'Invalid latitude'; end if;
  if p_longitude is not null and p_longitude not between -180 and 180 then raise exception 'Invalid longitude'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Latitude and longitude must be provided together'; end if;
  if coalesce(btrim(p_contact_phone),'') = '' then raise exception 'Contact phone is required'; end if;

  insert into public.home_collection_private_details (
    home_collection_request_id, patient_id, city, address, address_line2, postal_code,
    latitude, longitude, contact_phone, access_instructions, preferred_window
  ) values (
    v_home.id,v_uid,left(btrim(p_city),120),left(btrim(p_address),500),
    nullif(left(btrim(coalesce(p_address_line2,'')),250),''),
    nullif(left(btrim(coalesce(p_postal_code,'')),30),''),
    p_latitude,p_longitude,left(btrim(p_contact_phone),40),
    nullif(left(btrim(coalesce(p_access_instructions,'')),1000),''),
    nullif(left(btrim(coalesce(p_preferred_window,'')),160),'')
  )
  on conflict (home_collection_request_id) do update
  set city=excluded.city,
      address=excluded.address,
      address_line2=excluded.address_line2,
      postal_code=excluded.postal_code,
      latitude=excluded.latitude,
      longitude=excluded.longitude,
      contact_phone=excluded.contact_phone,
      access_instructions=excluded.access_instructions,
      preferred_window=excluded.preferred_window,
      updated_at=now();

  return v_home.id;
end;
$function$;

revoke all on function "public"."submit_home_collection_private_details"(p_home_collection_request_id uuid, p_city text, p_address text, p_address_line2 text, p_postal_code text, p_latitude numeric, p_longitude numeric, p_contact_phone text, p_access_instructions text, p_preferred_window text) from public,anon,authenticated,service_role;

grant execute on function "public"."submit_home_collection_private_details"(p_home_collection_request_id uuid, p_city text, p_address text, p_address_line2 text, p_postal_code text, p_latitude numeric, p_longitude numeric, p_contact_phone text, p_access_instructions text, p_preferred_window text) to "postgres";

grant execute on function "public"."submit_home_collection_private_details"(p_home_collection_request_id uuid, p_city text, p_address text, p_address_line2 text, p_postal_code text, p_latitude numeric, p_longitude numeric, p_contact_phone text, p_access_instructions text, p_preferred_window text) to "authenticated";

CREATE OR REPLACE FUNCTION public.get_home_collection_private_details(p_home_collection_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_home public.home_collection_requests%rowtype;
  v_details public.home_collection_private_details%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_home from public.home_collection_requests h
  where h.id=p_home_collection_request_id;
  if not found then raise exception 'Home collection request not found'; end if;
  if not public.is_laboratory_branch_member(v_home.laboratory_branch_id,v_uid) then
    raise exception 'Only an authorized member of the destination laboratory can view exact home address'; end if;
  if v_home.status in ('rejected','cancelled') then raise exception 'Home collection request is not active'; end if;

  select * into v_details from public.home_collection_private_details d
  where d.home_collection_request_id=v_home.id;
  if not found then raise exception 'Home address has not been submitted yet'; end if;

  insert into public.lab_workflow_events(
    actor_id,event_type,entity_type,entity_id,patient_id,doctor_id,laboratory_branch_id,
    physician_lab_request_id,lab_dispatch_id,lab_order_id,home_collection_request_id,metadata
  ) values (
    v_uid,'home_address.viewed','home_collection_private_details',v_home.id,
    v_home.patient_id,v_home.doctor_id,v_home.laboratory_branch_id,
    v_home.physician_lab_request_id,v_home.lab_dispatch_id,v_home.lab_order_id,
    v_home.id,jsonb_build_object('exact_address_returned',true)
  );

  return jsonb_build_object(
    'home_collection_request_id',v_home.id,
    'city',v_details.city,
    'address',v_details.address,
    'address_line2',v_details.address_line2,
    'postal_code',v_details.postal_code,
    'latitude',v_details.latitude,
    'longitude',v_details.longitude,
    'contact_phone',v_details.contact_phone,
    'access_instructions',v_details.access_instructions,
    'preferred_window',v_details.preferred_window
  );
end;
$function$;

revoke all on function "public"."get_home_collection_private_details"(p_home_collection_request_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."get_home_collection_private_details"(p_home_collection_request_id uuid) to "postgres";

grant execute on function "public"."get_home_collection_private_details"(p_home_collection_request_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.finalize_lab_report(p_report_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'pg_temp'
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
      or v_order_owner=v_uid
      or (lo.laboratory_branch_id is not null and public.is_laboratory_branch_member(lo.laboratory_branch_id,v_uid))
    )
  for update of dr;

  if v_order_id is null then raise exception 'Draft diagnostic report not found'; end if;

  if not (
    v_order_owner=v_uid
    or (v_branch_id is not null and public.is_laboratory_branch_member(v_branch_id,v_uid))
  ) then
    raise exception 'Only authorized staff of the destination branch can finalize';
  end if;

  if not exists (
    select 1 from public.lab_orders lo
    where lo.id=v_order_id
      and lo.status='in_progress'
      and (
        lo.laboratory_id=v_uid
        or (lo.laboratory_branch_id is not null and public.is_laboratory_branch_member(lo.laboratory_branch_id,v_uid))
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

revoke all on function "public"."finalize_lab_report"(p_report_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."finalize_lab_report"(p_report_id uuid) to "postgres";

grant execute on function "public"."finalize_lab_report"(p_report_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.respond_to_doctor_request(p_relationship_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_relationship public.patient_doctor_relationships%rowtype;
  v_next_status public.relationship_status;
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Invalid relationship decision';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role = 'patient'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Patient account required';
  END IF;

  SELECT pdr.* INTO v_relationship
  FROM public.patient_doctor_relationships pdr
  WHERE pdr.id = p_relationship_id
    AND pdr.patient_id = v_uid
    AND pdr.status = 'pending'::public.relationship_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending doctor request not found';
  END IF;

  IF p_decision = 'accept' THEN
    v_next_status := 'active'::public.relationship_status;
    v_notification_type := 'doctor_connection_accepted';
    v_notification_title := 'درخواست ارتباط تأیید شد';
    v_notification_body := 'بیمار درخواست برقراری ارتباط شما را تأیید کرده است.';
  ELSE
    v_next_status := 'inactive'::public.relationship_status;
    v_notification_type := 'doctor_connection_rejected';
    v_notification_title := 'درخواست ارتباط رد شد';
    v_notification_body := 'بیمار درخواست برقراری ارتباط شما را رد کرده است.';
  END IF;

  UPDATE public.patient_doctor_relationships
  SET status = v_next_status
  WHERE id = v_relationship.id
  RETURNING * INTO v_relationship;

  INSERT INTO public.notifications (
    recipient_id, type, title, body,
    related_entity_type, related_entity_id
  ) VALUES (
    v_relationship.doctor_id,
    v_notification_type,
    v_notification_title,
    v_notification_body,
    'patient_doctor_relationship',
    v_relationship.id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'relationship_id', v_relationship.id,
    'doctor_id', v_relationship.doctor_id,
    'status', v_relationship.status::text,
    'decision', p_decision
  );
END;
$function$;

revoke all on function "public"."respond_to_doctor_request"(p_relationship_id uuid, p_decision text) from public,anon,authenticated,service_role;

grant execute on function "public"."respond_to_doctor_request"(p_relationship_id uuid, p_decision text) to "postgres";

grant execute on function "public"."respond_to_doctor_request"(p_relationship_id uuid, p_decision text) to "authenticated";

CREATE OR REPLACE FUNCTION public.correct_lab_observation(p_report_id uuid, p_observation_id uuid, p_value_numeric numeric DEFAULT NULL::numeric, p_value_text text DEFAULT NULL::text, p_value_boolean boolean DEFAULT NULL::boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'pg_temp'
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
      or (lo.laboratory_branch_id is not null and public.is_laboratory_branch_member(lo.laboratory_branch_id, v_uid))
    )
  for update of o;

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

revoke all on function "public"."correct_lab_observation"(p_report_id uuid, p_observation_id uuid, p_value_numeric numeric, p_value_text text, p_value_boolean boolean) from public,anon,authenticated,service_role;

grant execute on function "public"."correct_lab_observation"(p_report_id uuid, p_observation_id uuid, p_value_numeric numeric, p_value_text text, p_value_boolean boolean) to "postgres";

grant execute on function "public"."correct_lab_observation"(p_report_id uuid, p_observation_id uuid, p_value_numeric numeric, p_value_text text, p_value_boolean boolean) to "authenticated";

CREATE OR REPLACE FUNCTION private.is_current_user_member_of_lab_request(p_request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select auth.uid() is not null and exists (
    select 1
    from public.lab_dispatches d
    join public.laboratory_branch_members lbm on lbm.branch_id=d.laboratory_branch_id
    where d.physician_lab_request_id=p_request_id
      and lbm.profile_id=auth.uid()
      and lbm.is_active=true
  );
$function$;

revoke all on function "private"."is_current_user_member_of_lab_request"(p_request_id uuid) from public,anon,authenticated,service_role;

grant execute on function "private"."is_current_user_member_of_lab_request"(p_request_id uuid) to "postgres";

grant execute on function "private"."is_current_user_member_of_lab_request"(p_request_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.save_preliminary_lab_observations(p_order_id uuid, p_report_id uuid DEFAULT NULL::uuid, p_results jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_order public.lab_orders%rowtype;
  v_report public.diagnostic_reports%rowtype;
  v_report_id uuid;
  v_item jsonb;
  v_test_id uuid;
  v_value_type text;
  v_allows_negative boolean;
  v_unit text;
  v_numeric numeric;
  v_text text;
  v_boolean boolean;
  v_set_count integer;
  v_saved integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_order
  from public.lab_orders lo where lo.id=p_order_id for update;
  if not found then raise exception 'Lab order not found'; end if;

  if not (
    v_order.laboratory_id=v_uid
    or (v_order.laboratory_branch_id is not null
      and exists (
        select 1 from public.laboratory_branch_members lbm
        where lbm.branch_id=v_order.laboratory_branch_id
          and lbm.profile_id=v_uid and lbm.is_active=true
      ))
  ) then raise exception 'Not authorized for this lab order'; end if;

  if v_order.status <> 'in_progress' then
    raise exception 'Lab order must be in_progress before entering results';
  end if;

  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 100 then
    raise exception 'Results must be a JSON array with at most 100 values';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_results) with ordinality as a(value, ordinality)
    join jsonb_array_elements(p_results) with ordinality as b(value, ordinality)
      on a.ordinality < b.ordinality
    where a.value->>'test_definition_id' = b.value->>'test_definition_id'
  ) then
    raise exception 'Duplicate test_definition_id in result payload';
  end if;

  if p_report_id is null then
    insert into public.diagnostic_reports (lab_order_id,laboratory_id,status,entered_by)
    values (v_order.id,v_uid,'draft',v_uid)
    returning id into v_report_id;
  else
    select * into v_report
    from public.diagnostic_reports dr
    where dr.id=p_report_id and dr.lab_order_id=v_order.id
    for update;
    if not found then raise exception 'Diagnostic report does not belong to this order'; end if;
    if v_report.status <> 'draft' then raise exception 'Only draft reports accept preliminary values'; end if;
    if not (
      v_report.laboratory_id=v_uid
      or (v_order.laboratory_branch_id is not null
        and exists (
          select 1 from public.laboratory_branch_members lbm
          where lbm.branch_id=v_order.laboratory_branch_id
            and lbm.profile_id=v_uid and lbm.is_active=true
        ))
    ) then raise exception 'Not authorized for this diagnostic report'; end if;
    v_report_id := v_report.id;
  end if;

  for v_item in select value from jsonb_array_elements(p_results)
  loop
    begin
      v_test_id := nullif(v_item->>'test_definition_id','')::uuid;
    exception when others then
      raise exception 'Invalid test_definition_id in result payload';
    end;
    if v_test_id is null then raise exception 'Each result must include test_definition_id'; end if;

    select td.value_type,td.allows_negative,td.default_unit
      into v_value_type,v_allows_negative,v_unit
    from public.test_definitions td
    where td.id=v_test_id and td.is_active=true;
    if v_value_type is null then raise exception 'Test definition is missing or inactive'; end if;

    if not exists (
      select 1 from public.lab_order_items loi
      where loi.lab_order_id=v_order.id
        and (
          loi.test_definition_id=v_test_id
          or exists (
            select 1 from public.test_panel_items tpi
            where tpi.panel_id=loi.test_panel_id and tpi.test_definition_id=v_test_id
          )
        )
    ) then raise exception 'Test is not included in this lab order'; end if;

    v_numeric := null;
    v_text := null;
    v_boolean := null;
    v_set_count := 0;

    if nullif(btrim(coalesce(v_item->>'value_numeric','')),'') is not null then
      begin
        v_numeric := (v_item->>'value_numeric')::numeric;
      exception when others then
        raise exception 'Invalid numeric value for test %',v_test_id;
      end;
      v_set_count := v_set_count + 1;
    end if;

    if nullif(btrim(coalesce(v_item->>'value_text','')),'') is not null then
      v_text := left(btrim(v_item->>'value_text'),10000);
      v_set_count := v_set_count + 1;
    end if;

    if nullif(v_item->>'value_boolean','') is not null then
      if lower(v_item->>'value_boolean') not in ('true','false') then
        raise exception 'Invalid boolean value for test %',v_test_id;
      end if;
      v_boolean := lower(v_item->>'value_boolean')='true';
      v_set_count := v_set_count + 1;
    end if;

    if v_set_count <> 1 then raise exception 'Exactly one typed result value is required for test %',v_test_id; end if;

    if (v_value_type='numeric' and v_numeric is null)
       or (v_value_type='text' and v_text is null)
       or (v_value_type='boolean' and v_boolean is null)
       or v_value_type not in ('numeric','text','boolean') then
      raise exception 'Result value type does not match test definition';
    end if;

    if (v_value_type <> 'numeric' and v_numeric is not null)
       or (v_value_type <> 'text' and v_text is not null)
       or (v_value_type <> 'boolean' and v_boolean is not null) then
      raise exception 'Result value type does not match test definition';
    end if;

    if v_numeric::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Numeric result must be finite';
    end if;
    if v_numeric < 0 and not v_allows_negative then
      raise exception 'Negative value is not allowed for this test';
    end if;

    update public.observations o
    set status='superseded'
    where o.diagnostic_report_id=v_report_id
      and o.test_definition_id=v_test_id
      and o.status='preliminary';

    insert into public.observations (
      diagnostic_report_id,test_definition_id,value_numeric,value_text,value_boolean,
      unit,status,entered_by
    ) values (
      v_report_id,v_test_id,v_numeric,v_text,v_boolean,coalesce(v_unit,''),
      'preliminary',v_uid
    );

    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('ok',true,'report_id',v_report_id,'saved_count',v_saved,'status','draft');
end;
$function$;

revoke all on function "public"."save_preliminary_lab_observations"(p_order_id uuid, p_report_id uuid, p_results jsonb) from public,anon,authenticated,service_role;

grant execute on function "public"."save_preliminary_lab_observations"(p_order_id uuid, p_report_id uuid, p_results jsonb) to "postgres";

CREATE OR REPLACE FUNCTION public.audit_physician_care_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_entity_id uuid;
  v_action text;
  v_metadata jsonb := '{}'::jsonb;
  v_row jsonb;
begin
  v_row := to_jsonb(new);
  v_entity_id := nullif(v_row ->> 'id', '')::uuid;
  if v_entity_id is null then return new; end if;

  v_action := case when tg_op='INSERT'
    then tg_table_name || '_created'
    else tg_table_name || '_updated'
  end;

  if tg_table_name='follow_ups' then
    v_metadata := jsonb_build_object('patient_id',v_row->>'patient_id','status',v_row->>'status','due_date',v_row->>'due_date');
  elsif tg_table_name='visits' then
    v_metadata := jsonb_build_object('patient_id',v_row->>'patient_id','status',v_row->>'status','visit_date',v_row->>'visit_date');
  elsif tg_table_name='doctor_notes' then
    v_metadata := jsonb_build_object('patient_id',v_row->>'patient_id','diagnostic_report_id',v_row->>'diagnostic_report_id','content_length',length(coalesce(v_row->>'content','')));
  elsif tg_table_name='voice_notes' then
    v_metadata := jsonb_build_object('patient_id',v_row->>'patient_id','visit_id',v_row->>'visit_id','duration',v_row->>'duration','archived',(v_row->>'archived_at') is not null);
  elsif tg_table_name='transcripts' then
    v_metadata := jsonb_build_object('voice_note_id',v_row->>'voice_note_id','transcript_length',length(coalesce(v_row->>'transcript_text','')));
  elsif tg_table_name='visit_summaries' then
    v_metadata := jsonb_build_object('voice_note_id',v_row->>'voice_note_id','doctor_confirmed',(v_row->>'doctor_confirmed')::boolean,'summary_length',length(coalesce(v_row->>'summary','')));
  elsif tg_table_name='consents' then
    v_metadata := jsonb_build_object('consent_type',v_row->>'consent_type','granted',(v_row->>'granted')::boolean,'revoked_at',v_row->>'revoked_at');
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor_id,v_action,tg_table_name,v_entity_id,v_metadata);
  return new;
end;
$function$;

revoke all on function "public"."audit_physician_care_event"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_physician_care_event"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  if tg_op='INSERT' then
    if new.doctor_id <> v_uid then
      raise exception 'Visit doctor must equal current user';
    end if;
    if not exists (
      select 1
      from public.doctor_profiles dp
      join public.profiles p on p.id=dp.id
      where dp.id=v_uid
        and dp.is_verified=true
        and p.role='doctor'::public.user_role
    ) then
      raise exception 'Doctor must be verified';
    end if;
    if not exists (
      select 1 from public.patient_doctor_relationships
      where doctor_id=v_uid
        and patient_id=new.patient_id
        and status='active'
    ) then
      raise exception 'Doctor has no active relationship with patient';
    end if;
    if new.status <> 'scheduled' then
      raise exception 'New visits must start as scheduled';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Visit identity is immutable';
  end if;
  if v_uid <> old.doctor_id then
    raise exception 'Only the owning doctor can modify a visit';
  end if;
  if not exists (
    select 1
    from public.doctor_profiles dp
    join public.profiles p on p.id=dp.id
    where dp.id=v_uid
      and dp.is_verified=true
      and p.role='doctor'::public.user_role
  ) then
    raise exception 'Doctor must be verified';
  end if;
  if not exists (
    select 1 from public.patient_doctor_relationships
    where doctor_id=v_uid
      and patient_id=new.patient_id
      and status='active'
  ) then
    raise exception 'Doctor has no active relationship with patient';
  end if;

  if old.status in ('cancelled','completed') and new.status is distinct from old.status then
    raise exception 'Terminal visit cannot change status';
  elsif old.status='scheduled' and new.status not in ('scheduled','in_progress','cancelled') then
    raise exception 'Invalid visit status transition';
  elsif old.status='in_progress' and new.status not in ('in_progress','completed','cancelled') then
    raise exception 'Invalid visit status transition';
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_visit"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_visit"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_doctor_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid();
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;
  if tg_op='INSERT' then
    if new.doctor_id is distinct from v_uid then raise exception 'Note doctor must equal current user'; end if;
    if not exists (select 1 from public.doctor_profiles where id=v_uid and is_verified=true) then
      raise exception 'Doctor must be verified';
    end if;
  else
    if new.id is distinct from old.id
       or new.patient_id is distinct from old.patient_id
       or new.doctor_id is distinct from old.doctor_id
       or new.diagnostic_report_id is distinct from old.diagnostic_report_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Note identity and provenance are immutable';
    end if;
    if old.doctor_id is distinct from v_uid then raise exception 'Only the owning doctor can modify a note'; end if;
    if not exists (select 1 from public.doctor_profiles where id=v_uid and is_verified=true) then
      raise exception 'Doctor must be verified';
    end if;
  end if;
  if not exists (
    select 1 from public.patient_doctor_relationships
    where doctor_id=v_uid and patient_id=new.patient_id and status='active'
  ) then raise exception 'Doctor has no active relationship with patient'; end if;
  if new.diagnostic_report_id is not null and not exists (
    select 1 from public.diagnostic_reports dr
    join public.lab_orders lo on lo.id=dr.lab_order_id
    where dr.id=new.diagnostic_report_id
      and lo.patient_id=new.patient_id and lo.doctor_id=v_uid
  ) then raise exception 'Note report does not belong to this patient and doctor'; end if;
  return new;
end;
$function$;

revoke all on function "public"."guard_doctor_note"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_doctor_note"() to "postgres";

CREATE OR REPLACE FUNCTION public.guard_voice_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_visit_doctor uuid;
  v_visit_patient uuid;
  v_consent_id uuid;
  v_expected_path text;
  v_object_size bigint;
  v_object_mime text;
  v_expected_mime text;
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  select doctor_id, patient_id into v_visit_doctor, v_visit_patient
  from public.visits where id=new.visit_id;

  if v_visit_doctor is null then raise exception 'Visit not found'; end if;
  if v_visit_doctor <> v_uid
     or new.doctor_id <> v_visit_doctor
     or new.patient_id <> v_visit_patient then
    raise exception 'Voice note does not match visit';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.doctor_profiles dp on dp.id=p.id
    where p.id=v_uid and p.role='doctor'::public.user_role and dp.is_verified=true
  ) then raise exception 'Verified doctor required'; end if;

  if not exists (
    select 1 from public.patient_doctor_relationships
    where doctor_id=v_uid and patient_id=new.patient_id and status='active'
  ) then raise exception 'Doctor has no active relationship with patient'; end if;

  if new.duration is null or new.duration < 30 or new.duration > 60 then
    raise exception 'Voice note duration must be between 30 and 60 seconds';
  end if;

  v_expected_path := new.doctor_id::text || '/' || new.id::text || '/' || new.patient_id::text || '.';
  if new.audio_path is null then raise exception 'Audio path is required'; end if;

  v_expected_mime := case
    when lower(new.audio_path)=lower(v_expected_path || 'webm') then 'audio/webm'
    when lower(new.audio_path)=lower(v_expected_path || 'ogg') then 'audio/ogg'
    when lower(new.audio_path)=lower(v_expected_path || 'mp3') then 'audio/mpeg'
    when lower(new.audio_path)=lower(v_expected_path || 'm4a') then 'audio/mp4'
    when lower(new.audio_path)=lower(v_expected_path || 'wav') then 'audio/wav'
    else null
  end;
  if v_expected_mime is null then
    raise exception 'Invalid voice note storage path';
  end if;

  if tg_op='UPDATE' then
    if new.id is distinct from old.id
       or new.visit_id is distinct from old.visit_id
       or new.patient_id is distinct from old.patient_id
       or new.doctor_id is distinct from old.doctor_id
       or new.audio_path is distinct from old.audio_path
       or new.duration is distinct from old.duration
       or new.created_at is distinct from old.created_at then
      raise exception 'Voice note identity, audio path and duration are immutable';
    end if;
    if old.archived_at is not null and new.archived_at is null then
      raise exception 'Archived voice note cannot be unarchived';
    end if;
  end if;

  select
    case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$'
      then (o.metadata->>'size')::bigint
      else null
    end,
    lower(coalesce(o.metadata->>'mimetype',''))
  into v_object_size, v_object_mime
  from storage.objects o
  where o.bucket_id='pab-voice-notes'
    and o.name=new.audio_path;

  if not found then
    raise exception 'Voice note audio object does not exist in private storage';
  end if;
  if v_object_size is null or v_object_size <= 0 or v_object_size > 2097152 then
    raise exception 'Voice note audio size is missing or outside the 2 MiB limit';
  end if;
  if v_object_mime not in ('audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav') then
    raise exception 'Voice note audio MIME type is not allowed';
  end if;
  if not (
    (v_expected_mime='audio/webm' and v_object_mime='audio/webm')
    or (v_expected_mime='audio/ogg' and v_object_mime='audio/ogg')
    or (v_expected_mime='audio/mpeg' and v_object_mime='audio/mpeg')
    or (v_expected_mime='audio/mp4' and v_object_mime in ('audio/mp4','audio/x-m4a'))
    or (v_expected_mime='audio/wav' and v_object_mime='audio/wav')
  ) then
    raise exception 'Voice note audio MIME type does not match file extension';
  end if;

  if tg_op='INSERT' then
    select c.id into v_consent_id
    from public.consents c
    where c.patient_id=new.patient_id
      and c.consent_type='physician_voice_recording'
      and c.granted=true
      and c.revoked_at is null
    order by c.granted_at desc
    limit 1
    for share;

    if v_consent_id is null then
      raise exception 'Active patient consent for physician voice recording is required';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_voice_note"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_voice_note"() to "postgres";

CREATE OR REPLACE FUNCTION public.submit_lab_request_to_branch(p_request_id uuid, p_branch_id uuid, p_requested_home_collection boolean DEFAULT false, p_city text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_address_line2 text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_contact_phone text DEFAULT NULL::text, p_access_instructions text DEFAULT NULL::text, p_preferred_window text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_request public.physician_lab_requests%rowtype;
  v_branch public.laboratory_branches%rowtype;
  v_dispatch_id uuid;
  v_home_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'patient')
     or not exists (select 1 from public.patient_profiles pp where pp.id = v_uid) then
    raise exception 'Patient account required';
  end if;

  select * into v_request
  from public.physician_lab_requests r
  where r.id = p_request_id
  for update;
  if not found or v_request.patient_id <> v_uid then
    raise exception 'Only the patient who owns this request can submit it';
  end if;
  if v_request.status <> 'submitted' then
    raise exception 'Only an open physician request can be submitted to a laboratory';
  end if;
  if not exists (
    select 1 from public.physician_lab_request_items ri
    where ri.physician_lab_request_id = v_request.id
  ) then
    raise exception 'Physician request has no test items';
  end if;
  if exists (
    select 1 from public.lab_dispatches d
    where d.physician_lab_request_id = v_request.id
      and d.status = 'pending'
  ) then
    raise exception 'This request already has a pending laboratory submission';
  end if;
  if exists (
    select 1 from public.lab_dispatches d
    where d.physician_lab_request_id = v_request.id
      and d.status = 'accepted'
  ) then
    raise exception 'A laboratory has already accepted this request';
  end if;

  select b.* into v_branch
  from public.laboratory_branches b
  join public.organizations o on o.id = b.organization_id
  where b.id = p_branch_id and b.is_active = true and o.type = 'laboratory';
  if not found then raise exception 'Active laboratory branch not found'; end if;

  if coalesce(p_requested_home_collection, false) and not v_branch.supports_home_collection then
    raise exception 'Selected laboratory branch does not support home collection';
  end if;

  if coalesce(p_requested_home_collection, false) then
    if length(btrim(coalesce(p_city, ''))) < 2
       or length(btrim(coalesce(p_address, ''))) < 5
       or length(btrim(coalesce(p_contact_phone, ''))) < 7 then
      raise exception 'City, exact address and contact phone are required for home collection';
    end if;
    if p_latitude is not null and p_latitude not between -90 and 90 then raise exception 'Invalid latitude'; end if;
    if p_longitude is not null and p_longitude not between -180 and 180 then raise exception 'Invalid longitude'; end if;
    if (p_latitude is null) <> (p_longitude is null) then raise exception 'Latitude and longitude must be provided together'; end if;
  end if;

  insert into public.lab_dispatches (
    physician_lab_request_id, laboratory_branch_id, created_by, status, requested_home_collection
  ) values (
    v_request.id, v_branch.id, v_uid, 'pending', coalesce(p_requested_home_collection, false)
  ) returning id into v_dispatch_id;

  if coalesce(p_requested_home_collection, false) then
    insert into public.home_collection_requests (
      physician_lab_request_id, lab_dispatch_id, laboratory_branch_id,
      patient_id, doctor_id, status
    ) values (
      v_request.id, v_dispatch_id, v_branch.id, v_request.patient_id, v_request.doctor_id, 'requested'
    ) returning id into v_home_id;

    insert into public.home_collection_private_details (
      home_collection_request_id, patient_id, city, address, address_line2, postal_code,
      latitude, longitude, contact_phone, access_instructions, preferred_window
    ) values (
      v_home_id, v_uid,
      left(btrim(p_city), 120), left(btrim(p_address), 500),
      nullif(left(btrim(coalesce(p_address_line2, '')), 250), ''),
      nullif(left(btrim(coalesce(p_postal_code, '')), 30), ''),
      p_latitude, p_longitude, left(btrim(p_contact_phone), 40),
      nullif(left(btrim(coalesce(p_access_instructions, '')), 1000), ''),
      nullif(left(btrim(coalesce(p_preferred_window, '')), 160), '')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'dispatch_id', v_dispatch_id,
    'home_collection_request_id', v_home_id,
    'branch_id', v_branch.id,
    'status', 'pending',
    'requested_home_collection', coalesce(p_requested_home_collection, false)
  );
end;
$function$;

revoke all on function "public"."submit_lab_request_to_branch"(p_request_id uuid, p_branch_id uuid, p_requested_home_collection boolean, p_city text, p_address text, p_address_line2 text, p_postal_code text, p_latitude numeric, p_longitude numeric, p_contact_phone text, p_access_instructions text, p_preferred_window text) from public,anon,authenticated,service_role;

grant execute on function "public"."submit_lab_request_to_branch"(p_request_id uuid, p_branch_id uuid, p_requested_home_collection boolean, p_city text, p_address text, p_address_line2 text, p_postal_code text, p_latitude numeric, p_longitude numeric, p_contact_phone text, p_access_instructions text, p_preferred_window text) to "postgres";

grant execute on function "public"."submit_lab_request_to_branch"(p_request_id uuid, p_branch_id uuid, p_requested_home_collection boolean, p_city text, p_address text, p_address_line2 text, p_postal_code text, p_latitude numeric, p_longitude numeric, p_contact_phone text, p_access_instructions text, p_preferred_window text) to "authenticated";

CREATE OR REPLACE FUNCTION public.get_patient_related_physicians(p_patient_id uuid)
 RETURNS TABLE(doctor_id uuid, full_name text, specialty text, relationship_type relationship_type, started_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.doctor_profiles dp on dp.id = p.id
    where p.id = v_uid
      and p.role = 'doctor'::public.user_role
      and dp.is_verified = true
  ) then
    raise exception 'Verified doctor required';
  end if;

  if not exists (
    select 1
    from public.patient_doctor_relationships pdr
    where pdr.patient_id = p_patient_id
      and pdr.doctor_id = v_uid
      and pdr.status = 'active'::public.relationship_status
  ) then
    raise exception 'Active patient-doctor relationship required';
  end if;

  return query
  select
    pdr.doctor_id,
    p.full_name,
    dp.specialty,
    pdr.relationship_type,
    pdr.started_at
  from public.patient_doctor_relationships pdr
  join public.profiles p on p.id = pdr.doctor_id
  join public.doctor_profiles dp on dp.id = pdr.doctor_id
  where pdr.patient_id = p_patient_id
    and pdr.status = 'active'::public.relationship_status
    and p.role = 'doctor'::public.user_role
    and dp.is_verified = true
  order by pdr.started_at desc nulls last, p.full_name;
end;
$function$;

revoke all on function "public"."get_patient_related_physicians"(p_patient_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."get_patient_related_physicians"(p_patient_id uuid) to "postgres";

grant execute on function "public"."get_patient_related_physicians"(p_patient_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.commit_physician_voice_note(p_patient_id uuid, p_visit_id uuid, p_voice_note_id uuid, p_audio_path text, p_duration numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_visit public.visits%rowtype;
  v_visit_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1
    from public.profiles p
    join public.doctor_profiles dp on dp.id=p.id
    where p.id=v_uid
      and p.role='doctor'::public.user_role
      and dp.is_verified=true
  ) then raise exception 'Verified doctor required'; end if;

  if p_patient_id is null or p_voice_note_id is null then
    raise exception 'Patient and voice note ids are required';
  end if;
  if p_duration is null or p_duration < 30 or p_duration > 60 then
    raise exception 'Voice note duration must be between 30 and 60 seconds';
  end if;
  if p_audio_path is null
     or p_audio_path not like v_uid::text || '/' || p_voice_note_id::text || '/%' then
    raise exception 'Invalid voice note storage path';
  end if;

  if not exists (
    select 1 from public.patient_doctor_relationships pdr
    where pdr.doctor_id=v_uid
      and pdr.patient_id=p_patient_id
      and pdr.status='active'
  ) then raise exception 'Doctor has no active relationship with patient'; end if;

  if exists (select 1 from public.voice_notes vn where vn.id=p_voice_note_id) then
    raise exception 'Voice note already exists';
  end if;

  if p_visit_id is null then
    insert into public.visits(patient_id,doctor_id,visit_date,status)
    values(p_patient_id,v_uid,now(),'scheduled')
    returning id into v_visit_id;

    update public.visits set status='in_progress' where id=v_visit_id;
    update public.visits set status='completed' where id=v_visit_id;
  else
    select * into v_visit
    from public.visits v
    where v.id=p_visit_id
      and v.patient_id=p_patient_id
      and v.doctor_id=v_uid
    for update;

    if not found then raise exception 'Visit not found or access denied'; end if;
    if v_visit.status='cancelled' then raise exception 'Cannot attach a voice note to a cancelled visit'; end if;

    v_visit_id := v_visit.id;
    if v_visit.status='scheduled' then
      update public.visits set status='in_progress' where id=v_visit_id;
      update public.visits set status='completed' where id=v_visit_id;
    elsif v_visit.status='in_progress' then
      update public.visits set status='completed' where id=v_visit_id;
    elsif v_visit.status <> 'completed' then
      raise exception 'Voice note cannot be attached to this visit status';
    end if;
  end if;

  insert into public.voice_notes(id,visit_id,patient_id,doctor_id,audio_path,duration)
  values(p_voice_note_id,v_visit_id,p_patient_id,v_uid,p_audio_path,round(p_duration,2));

  return jsonb_build_object('voice_note_id',p_voice_note_id,'visit_id',v_visit_id);
end;
$function$;

revoke all on function "public"."commit_physician_voice_note"(p_patient_id uuid, p_visit_id uuid, p_voice_note_id uuid, p_audio_path text, p_duration numeric) from public,anon,authenticated,service_role;

grant execute on function "public"."commit_physician_voice_note"(p_patient_id uuid, p_visit_id uuid, p_voice_note_id uuid, p_audio_path text, p_duration numeric) to "postgres";

grant execute on function "public"."commit_physician_voice_note"(p_patient_id uuid, p_visit_id uuid, p_voice_note_id uuid, p_audio_path text, p_duration numeric) to "authenticated";

CREATE OR REPLACE FUNCTION public.save_physician_visit_summary_draft(p_voice_note_id uuid, p_structured_content jsonb)
 RETURNS visit_summaries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid;
  v_key text;
  v_value text;
  v_total_length integer := 0;
  v_summary text;
  v_row public.visit_summaries%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.doctor_profiles dp on dp.id=p.id
    where p.id=v_uid
      and p.role='doctor'::public.user_role
      and dp.is_verified=true
  ) then raise exception 'Verified doctor required'; end if;

  if p_voice_note_id is null then raise exception 'Voice note id is required'; end if;
  if p_structured_content is null or jsonb_typeof(p_structured_content) is distinct from 'object' then
    raise exception 'Structured visit summary must be a JSON object';
  end if;

  select vn.patient_id into v_patient_id
  from public.voice_notes vn
  where vn.id=p_voice_note_id
    and vn.doctor_id=v_uid
    and vn.archived_at is null
  for share;

  if v_patient_id is null then raise exception 'Voice note not found or access denied'; end if;

  if not exists (
    select 1 from public.patient_doctor_relationships pdr
    where pdr.doctor_id=v_uid
      and pdr.patient_id=v_patient_id
      and pdr.status='active'
  ) then raise exception 'Active patient-doctor relationship required'; end if;

  for v_key, v_value in
    select key, value #>> '{}' from jsonb_each(p_structured_content)
  loop
    if v_key not in ('chief_complaint','history','exam_findings','clinical_assessment','plan','follow_up_instructions') then
      raise exception 'Unsupported structured visit summary field';
    end if;
    if jsonb_typeof(p_structured_content -> v_key) is distinct from 'string' then
      raise exception 'Structured visit summary fields must be text';
    end if;
    if length(coalesce(v_value,'')) > 3000 then
      raise exception 'A structured visit summary field exceeds 3000 characters';
    end if;
    v_total_length := v_total_length + length(coalesce(v_value,''));
  end loop;

  if v_total_length > 10000 then raise exception 'Structured visit summary exceeds 10000 characters'; end if;
  if not exists (
    select 1 from jsonb_each_text(p_structured_content) e where length(btrim(e.value))>0
  ) then raise exception 'Structured visit summary cannot be empty'; end if;

  v_summary := concat_ws(E'\n\n',
    nullif('علت مراجعه: ' || btrim(coalesce(p_structured_content ->> 'chief_complaint','')), 'علت مراجعه: '),
    nullif('شرح حال: ' || btrim(coalesce(p_structured_content ->> 'history','')), 'شرح حال: '),
    nullif('یافته‌های ثبت‌شده: ' || btrim(coalesce(p_structured_content ->> 'exam_findings','')), 'یافته‌های ثبت‌شده: '),
    nullif('ارزیابی پزشک: ' || btrim(coalesce(p_structured_content ->> 'clinical_assessment','')), 'ارزیابی پزشک: '),
    nullif('برنامه: ' || btrim(coalesce(p_structured_content ->> 'plan','')), 'برنامه: '),
    nullif('دستور پیگیری: ' || btrim(coalesce(p_structured_content ->> 'follow_up_instructions','')), 'دستور پیگیری: ')
  );

  select * into v_row
  from public.visit_summaries
  where voice_note_id=p_voice_note_id
  for update;

  if found then
    if v_row.doctor_confirmed then
      raise exception 'Confirmed visit summary is immutable';
    end if;

    update public.visit_summaries
    set structured_content=p_structured_content,
        summary=v_summary,
        updated_at=now()
    where id=v_row.id
    returning * into v_row;
  else
    insert into public.visit_summaries(
      voice_note_id,summary,structured_content,doctor_confirmed,confirmed_at
    )
    values(p_voice_note_id,v_summary,p_structured_content,false,null)
    returning * into v_row;
  end if;

  return v_row;
end;
$function$;

revoke all on function "public"."save_physician_visit_summary_draft"(p_voice_note_id uuid, p_structured_content jsonb) from public,anon,authenticated,service_role;

grant execute on function "public"."save_physician_visit_summary_draft"(p_voice_note_id uuid, p_structured_content jsonb) to "postgres";

grant execute on function "public"."save_physician_visit_summary_draft"(p_voice_note_id uuid, p_structured_content jsonb) to "authenticated";

CREATE OR REPLACE FUNCTION public.confirm_physician_visit_summary(p_voice_note_id uuid)
 RETURNS visit_summaries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid;
  v_row public.visit_summaries%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1
    from public.profiles p
    join public.doctor_profiles dp on dp.id=p.id
    where p.id=v_uid
      and p.role='doctor'::public.user_role
      and dp.is_verified=true
  ) then raise exception 'Verified doctor required'; end if;

  select vn.patient_id into v_patient_id
  from public.voice_notes vn
  where vn.id=p_voice_note_id
    and vn.doctor_id=v_uid
    and vn.archived_at is null
  for share;

  if v_patient_id is null then raise exception 'Voice note not found or access denied'; end if;
  if not exists (
    select 1 from public.patient_doctor_relationships pdr
    where pdr.doctor_id=v_uid
      and pdr.patient_id=v_patient_id
      and pdr.status='active'
  ) then raise exception 'Active patient-doctor relationship required'; end if;

  select * into v_row
  from public.visit_summaries
  where voice_note_id=p_voice_note_id
  for update;

  if not found then raise exception 'Save a draft summary before confirming it'; end if;
  if v_row.doctor_confirmed then return v_row; end if;

  perform set_config('app.pab_visit_summary_confirmation', p_voice_note_id::text, true);

  update public.visit_summaries
  set doctor_confirmed=true,
      confirmed_at=now(),
      updated_at=now()
  where id=v_row.id
    and doctor_confirmed=false
  returning * into v_row;

  if not found then raise exception 'Summary was not confirmed'; end if;
  return v_row;
end;
$function$;

revoke all on function "public"."confirm_physician_visit_summary"(p_voice_note_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."confirm_physician_visit_summary"(p_voice_note_id uuid) to "postgres";

grant execute on function "public"."confirm_physician_visit_summary"(p_voice_note_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.guard_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid();
begin
  if public.is_service_role() then return new; end if;
  if v_uid is null then raise exception 'Authentication required'; end if;

  if tg_op='INSERT' then
    if new.patient_id is distinct from v_uid then
      raise exception 'Consent patient must equal current user';
    end if;
    if new.consent_type is null or btrim(new.consent_type) = '' then
      raise exception 'Consent type is required';
    end if;
    if new.consent_type='physician_voice_recording' then
      if new.granted is distinct from true then
        raise exception 'New voice-recording consent must be an explicit grant';
      end if;
      new.granted_at := now();
      new.revoked_at := null;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.patient_id is distinct from old.patient_id
     or new.consent_type is distinct from old.consent_type
     or new.granted_at is distinct from old.granted_at then
    raise exception 'Consent identity and grant timestamp are immutable';
  end if;
  if old.patient_id is distinct from v_uid then
    raise exception 'Only the consent owner can change consent';
  end if;

  if old.granted is false and new.granted is true then
    raise exception 'Re-grant consent by inserting a new consent record';
  end if;

  if old.granted is true and new.granted is false then
    -- Never trust caller-supplied revocation timestamps.
    new.revoked_at := now();
  elsif old.granted is false and new.granted is false then
    if new.revoked_at is distinct from old.revoked_at then
      raise exception 'Revoked consent history is immutable';
    end if;
  elsif old.granted is true and new.granted is true then
    if new.revoked_at is distinct from old.revoked_at then
      raise exception 'Revoke consent by setting granted=false';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function "public"."guard_consent"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_consent"() to "postgres";

CREATE OR REPLACE FUNCTION public.create_physician_lab_request(p_patient_id uuid, p_clinical_note text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_item jsonb;
  v_panel_id uuid;
  v_test_id uuid;
  v_count integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'doctor'
  ) or not exists (
    select 1 from public.doctor_profiles dp
    where dp.id = v_uid and dp.is_verified = true
  ) then
    raise exception 'Verified doctor required';
  end if;

  if not exists (
    select 1 from public.patient_profiles pp
    where pp.id = p_patient_id
  ) then
    raise exception 'Patient not found';
  end if;

  if not exists (
    select 1 from public.patient_doctor_relationships pdr
    where pdr.doctor_id = v_uid
      and pdr.patient_id = p_patient_id
      and pdr.status = 'active'
  ) then
    raise exception 'Active patient relationship required';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Request must include 1 to 100 tests or panels';
  end if;

  insert into public.physician_lab_requests (
    patient_id, doctor_id, created_by, clinical_note,
    requested_home_collection, status
  ) values (
    p_patient_id, v_uid, v_uid,
    nullif(left(btrim(coalesce(p_clinical_note, '')), 2000), ''),
    false, 'submitted'
  ) returning id into v_request_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_panel_id := nullif(v_item->>'test_panel_id', '')::uuid;
    v_test_id := nullif(v_item->>'test_definition_id', '')::uuid;

    if (v_panel_id is null) = (v_test_id is null) then
      raise exception 'Each request item must specify exactly one test panel or test definition';
    end if;

    if v_panel_id is not null and not exists (
      select 1 from public.test_panels tp
      where tp.id = v_panel_id and tp.is_active = true
    ) then
      raise exception 'Test panel is inactive or missing';
    end if;

    if v_test_id is not null and not exists (
      select 1 from public.test_definitions td
      where td.id = v_test_id and td.is_active = true
    ) then
      raise exception 'Test definition is inactive or missing';
    end if;

    insert into public.physician_lab_request_items (
      physician_lab_request_id, test_panel_id, test_definition_id
    ) values (v_request_id, v_panel_id, v_test_id);

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'item_count', v_count,
    'status', 'submitted',
    'dispatch_created', false
  );
end;
$function$;

revoke all on function "public"."create_physician_lab_request"(p_patient_id uuid, p_clinical_note text, p_items jsonb) from public,anon,authenticated,service_role;

grant execute on function "public"."create_physician_lab_request"(p_patient_id uuid, p_clinical_note text, p_items jsonb) to "postgres";

grant execute on function "public"."create_physician_lab_request"(p_patient_id uuid, p_clinical_note text, p_items jsonb) to "authenticated";

CREATE OR REPLACE FUNCTION public.search_laboratory_branches(p_query text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_limit integer DEFAULT 20)
 RETURNS TABLE(branch_id uuid, organization_id uuid, organization_name text, display_name text, city text, address text, latitude numeric, longitude numeric, supports_home_collection boolean, distance_km double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query text := lower(regexp_replace(translate(btrim(coalesce(p_query, '')), 'يىك', 'ییک'), '[[:space:]]+', ' ', 'g'));
  v_city text := lower(regexp_replace(translate(btrim(coalesce(p_city, '')), 'يىك', 'ییک'), '[[:space:]]+', ' ', 'g'));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_latitude is not null and p_latitude not between -90 and 90 then raise exception 'Invalid latitude'; end if;
  if p_longitude is not null and p_longitude not between -180 and 180 then raise exception 'Invalid longitude'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Latitude and longitude must be provided together'; end if;

  return query
  select
    b.id,
    b.organization_id,
    o.name,
    b.display_name,
    b.city,
    b.address,
    b.latitude,
    b.longitude,
    b.supports_home_collection,
    case
      when p_latitude is null or b.latitude is null or b.longitude is null then null
      else 6371.0 * acos(least(1.0, greatest(-1.0,
        cos(radians(p_latitude)) * cos(radians(b.latitude::double precision))
        * cos(radians(b.longitude::double precision) - radians(p_longitude))
        + sin(radians(p_latitude)) * sin(radians(b.latitude::double precision))
      )))
    end as distance_km
  from public.laboratory_branches b
  join public.organizations o on o.id = b.organization_id
  where b.is_active = true
    and o.type = 'laboratory'
    and (
      v_query = ''
      or translate(lower(regexp_replace(concat_ws(' ', b.display_name, o.name, b.city, b.address), '[[:space:]]+', ' ', 'g')), 'يىك', 'ییک')
         ilike '%' || v_query || '%'
    )
    and (
      v_city = ''
      or translate(lower(regexp_replace(coalesce(b.city, ''), '[[:space:]]+', ' ', 'g')), 'يىك', 'ییک')
         ilike '%' || v_city || '%'
    )
  order by distance_km asc nulls last, b.display_name asc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$function$;

revoke all on function "public"."search_laboratory_branches"(p_query text, p_city text, p_latitude double precision, p_longitude double precision, p_limit integer) from public,anon,authenticated,service_role;

grant execute on function "public"."search_laboratory_branches"(p_query text, p_city text, p_latitude double precision, p_longitude double precision, p_limit integer) to "postgres";

grant execute on function "public"."search_laboratory_branches"(p_query text, p_city text, p_latitude double precision, p_longitude double precision, p_limit integer) to "authenticated";

CREATE OR REPLACE FUNCTION public.admin_list_laboratory_organizations()
 RETURNS TABLE(organization_id uuid, organization_name text, branch_count bigint, has_laboratory_profile boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id=v_uid and p.role='admin'
  ) then raise exception 'Administrator access required'; end if;

  return query
  select o.id,o.name,count(b.id),exists(
    select 1 from public.laboratory_profiles lp where lp.organization_id=o.id
  )
  from public.organizations o
  left join public.laboratory_branches b on b.organization_id=o.id
  where o.type='laboratory'
  group by o.id,o.name
  order by o.name;
end;
$function$;

revoke all on function "public"."admin_list_laboratory_organizations"() from public,anon,authenticated,service_role;

grant execute on function "public"."admin_list_laboratory_organizations"() to "postgres";

grant execute on function "public"."admin_list_laboratory_organizations"() to "authenticated";

CREATE OR REPLACE FUNCTION public.admin_list_laboratory_branches(p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(branch_id uuid, organization_id uuid, organization_name text, display_name text, city text, address text, latitude numeric, longitude numeric, is_active boolean, supports_home_collection boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id=v_uid and p.role='admin'
  ) then raise exception 'Administrator access required'; end if;

  return query
  select b.id,b.organization_id,o.name,b.display_name,b.city,b.address,
         b.latitude,b.longitude,b.is_active,b.supports_home_collection,b.created_at,b.updated_at
  from public.laboratory_branches b
  join public.organizations o on o.id=b.organization_id
  where o.type='laboratory'
    and (p_organization_id is null or b.organization_id=p_organization_id)
  order by o.name,b.display_name;
end;
$function$;

revoke all on function "public"."admin_list_laboratory_branches"(p_organization_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."admin_list_laboratory_branches"(p_organization_id uuid) to "postgres";

grant execute on function "public"."admin_list_laboratory_branches"(p_organization_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.admin_upsert_laboratory_branch(p_branch_id uuid, p_organization_id uuid, p_display_name text, p_city text, p_address text, p_latitude numeric, p_longitude numeric, p_is_active boolean, p_supports_home_collection boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_branch_id uuid;
  v_existing_organization uuid;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id=v_uid and p.role='admin'
  ) then raise exception 'Administrator access required'; end if;

  if length(btrim(coalesce(p_display_name,''))) < 2 or length(btrim(p_display_name)) > 160 then
    raise exception 'Branch display name must contain 2 to 160 characters';
  end if;
  if p_latitude is not null and p_latitude not between -90 and 90 then raise exception 'Invalid latitude'; end if;
  if p_longitude is not null and p_longitude not between -180 and 180 then raise exception 'Invalid longitude'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Latitude and longitude must be provided together'; end if;
  if not exists (
    select 1 from public.organizations o where o.id=p_organization_id and o.type='laboratory'
  ) then raise exception 'Laboratory organization not found'; end if;

  if p_branch_id is null then
    insert into public.laboratory_branches(
      organization_id,display_name,city,address,latitude,longitude,is_active,supports_home_collection,created_by
    ) values (
      p_organization_id,left(btrim(p_display_name),160),nullif(left(btrim(coalesce(p_city,'')),120),''),
      nullif(left(btrim(coalesce(p_address,'')),500),''),p_latitude,p_longitude,
      coalesce(p_is_active,true),coalesce(p_supports_home_collection,false),v_uid
    ) returning id into v_branch_id;
  else
    select b.organization_id into v_existing_organization
    from public.laboratory_branches b where b.id=p_branch_id for update;
    if not found or v_existing_organization is distinct from p_organization_id then
      raise exception 'Branch not found for the selected laboratory organization';
    end if;

    update public.laboratory_branches b
    set display_name=left(btrim(p_display_name),160),
        city=nullif(left(btrim(coalesce(p_city,'')),120),''),
        address=nullif(left(btrim(coalesce(p_address,'')),500),''),
        latitude=p_latitude,
        longitude=p_longitude,
        is_active=coalesce(p_is_active,true),
        supports_home_collection=coalesce(p_supports_home_collection,false),
        updated_at=now()
    where b.id=p_branch_id
    returning b.id into v_branch_id;
  end if;

  return v_branch_id;
end;
$function$;

revoke all on function "public"."admin_upsert_laboratory_branch"(p_branch_id uuid, p_organization_id uuid, p_display_name text, p_city text, p_address text, p_latitude numeric, p_longitude numeric, p_is_active boolean, p_supports_home_collection boolean) from public,anon,authenticated,service_role;

grant execute on function "public"."admin_upsert_laboratory_branch"(p_branch_id uuid, p_organization_id uuid, p_display_name text, p_city text, p_address text, p_latitude numeric, p_longitude numeric, p_is_active boolean, p_supports_home_collection boolean) to "postgres";

grant execute on function "public"."admin_upsert_laboratory_branch"(p_branch_id uuid, p_organization_id uuid, p_display_name text, p_city text, p_address text, p_latitude numeric, p_longitude numeric, p_is_active boolean, p_supports_home_collection boolean) to "authenticated";

CREATE OR REPLACE FUNCTION public.admin_list_laboratory_branch_members(p_branch_id uuid)
 RETURNS TABLE(profile_id uuid, full_name text, license_number text, role_in_branch text, is_active boolean, granted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id=v_uid and p.role='admin'
  ) then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.laboratory_branches b where b.id=p_branch_id) then
    raise exception 'Laboratory branch not found';
  end if;

  return query
  select lbm.profile_id,p.full_name,lp.license_number,lbm.role_in_branch,lbm.is_active,lbm.created_at
  from public.laboratory_branch_members lbm
  join public.profiles p on p.id=lbm.profile_id
  join public.laboratory_profiles lp on lp.id=lbm.profile_id
  where lbm.branch_id=p_branch_id
  order by lbm.created_at,p.full_name;
end;
$function$;

revoke all on function "public"."admin_list_laboratory_branch_members"(p_branch_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."admin_list_laboratory_branch_members"(p_branch_id uuid) to "postgres";

grant execute on function "public"."admin_list_laboratory_branch_members"(p_branch_id uuid) to "authenticated";

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

  if coalesce(btrim(p_role_in_branch),'') not in ('manager','reception','laboratory_staff','member') then
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

revoke all on function "public"."admin_set_laboratory_branch_member"(p_branch_id uuid, p_profile_id uuid, p_role_in_branch text, p_is_active boolean) from public,anon,authenticated,service_role;

grant execute on function "public"."admin_set_laboratory_branch_member"(p_branch_id uuid, p_profile_id uuid, p_role_in_branch text, p_is_active boolean) to "postgres";

grant execute on function "public"."admin_set_laboratory_branch_member"(p_branch_id uuid, p_profile_id uuid, p_role_in_branch text, p_is_active boolean) to "authenticated";

CREATE OR REPLACE FUNCTION public.cancel_lab_dispatch_by_patient(p_dispatch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dispatch public.lab_dispatches%rowtype;
  v_request public.physician_lab_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_dispatch from public.lab_dispatches d
  where d.id = p_dispatch_id for update;
  if not found then raise exception 'Laboratory submission not found'; end if;

  select * into v_request from public.physician_lab_requests r
  where r.id = v_dispatch.physician_lab_request_id for update;
  if not found or v_request.patient_id <> v_uid then
    raise exception 'Only the patient who owns this request can cancel the submission';
  end if;

  if v_dispatch.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'dispatch_id', v_dispatch.id, 'status', 'cancelled', 'idempotent', true);
  end if;
  if v_dispatch.status <> 'pending' then
    raise exception 'Only a pending submission can be cancelled';
  end if;

  update public.lab_dispatches
  set status = 'cancelled', response_note = 'Cancelled by patient'
  where id = v_dispatch.id;

  update public.home_collection_requests
  set status = 'cancelled', cancelled_at = now()
  where lab_dispatch_id = v_dispatch.id and status in ('requested', 'approved', 'scheduled');

  return jsonb_build_object('ok', true, 'dispatch_id', v_dispatch.id, 'status', 'cancelled', 'idempotent', false);
end;
$function$;

revoke all on function "public"."cancel_lab_dispatch_by_patient"(p_dispatch_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."cancel_lab_dispatch_by_patient"(p_dispatch_id uuid) to "postgres";

grant execute on function "public"."cancel_lab_dispatch_by_patient"(p_dispatch_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.advance_home_collection_request(p_home_collection_request_id uuid, p_next_status text, p_scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone, p_collector_profile_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_home public.home_collection_requests%rowtype;
  v_is_branch_member boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_next_status not in ('requested','approved','rejected','scheduled','dispatched','collected','cancelled') then
    raise exception 'Invalid home collection status';
  end if;

  select * into v_home from public.home_collection_requests h
  where h.id=p_home_collection_request_id for update;
  if not found then raise exception 'Home collection request not found'; end if;

  v_is_branch_member := public.is_laboratory_branch_member(v_home.laboratory_branch_id,v_uid);

  if p_next_status in ('approved','rejected','scheduled','dispatched','collected') and not v_is_branch_member then
    raise exception 'Only destination laboratory staff can manage this collection';
  end if;
  if p_next_status in ('requested','cancelled')
     and v_uid not in (v_home.patient_id,v_home.doctor_id)
     and not v_is_branch_member then
    raise exception 'Not authorized to manage this collection request';
  end if;

  if p_next_status = v_home.status then
    return jsonb_build_object(
      'ok',true,
      'home_collection_request_id',v_home.id,
      'status',v_home.status,
      'idempotent',true
    );
  end if;

  if p_next_status='scheduled' then
    if p_scheduled_for is null or p_scheduled_for <= now() then
      raise exception 'Scheduled visit must be in the future';
    end if;
    if p_collector_profile_id is null or not exists (
      select 1 from public.laboratory_branch_members lbm
      where lbm.branch_id=v_home.laboratory_branch_id
        and lbm.profile_id=p_collector_profile_id and lbm.is_active=true
    ) then raise exception 'Collector must be an active member of the destination branch'; end if;
  end if;

  update public.home_collection_requests
  set status=p_next_status,
      approved_at=case when p_next_status='approved' then now() else approved_at end,
      rejected_at=case when p_next_status='rejected' then now() else rejected_at end,
      rejection_reason=case when p_next_status='rejected' then nullif(left(btrim(coalesce(p_note,'')),1000),'') else rejection_reason end,
      scheduled_for=case when p_next_status='scheduled' then p_scheduled_for else scheduled_for end,
      collector_profile_id=case when p_next_status='scheduled' then p_collector_profile_id else collector_profile_id end,
      dispatched_at=case when p_next_status='dispatched' then now() else dispatched_at end,
      cancelled_at=case when p_next_status='cancelled' then now() else cancelled_at end,
      collection_note=case when p_note is not null then left(btrim(p_note),1000) else collection_note end
  where id=p_home_collection_request_id;

  return jsonb_build_object(
    'ok',true,
    'home_collection_request_id',p_home_collection_request_id,
    'status',p_next_status,
    'idempotent',false
  );
end;
$function$;

revoke all on function "public"."advance_home_collection_request"(p_home_collection_request_id uuid, p_next_status text, p_scheduled_for timestamp with time zone, p_collector_profile_id uuid, p_note text) from public,anon,authenticated,service_role;

grant execute on function "public"."advance_home_collection_request"(p_home_collection_request_id uuid, p_next_status text, p_scheduled_for timestamp with time zone, p_collector_profile_id uuid, p_note text) to "postgres";

grant execute on function "public"."advance_home_collection_request"(p_home_collection_request_id uuid, p_next_status text, p_scheduled_for timestamp with time zone, p_collector_profile_id uuid, p_note text) to "authenticated";

CREATE OR REPLACE FUNCTION public.get_lab_dispatch_details(p_dispatch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dispatch public.lab_dispatches%rowtype;
  v_request public.physician_lab_requests%rowtype;
  v_branch public.laboratory_branches%rowtype;
  v_patient_name text;
  v_doctor_name text;
  v_items jsonb;
  v_home public.home_collection_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_dispatch from public.lab_dispatches d where d.id=p_dispatch_id;
  if not found then raise exception 'Laboratory submission not found'; end if;
  if not public.is_laboratory_branch_member(v_dispatch.laboratory_branch_id,v_uid) then
    raise exception 'Only the destination laboratory can view this submission';
  end if;

  select * into v_request from public.physician_lab_requests r where r.id=v_dispatch.physician_lab_request_id;
  select * into v_branch from public.laboratory_branches b where b.id=v_dispatch.laboratory_branch_id;
  select p.full_name into v_patient_name from public.profiles p where p.id=v_request.patient_id;
  select p.full_name into v_doctor_name from public.profiles p where p.id=v_request.doctor_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'request_item_id',ri.id,
      'item_type',case when ri.test_panel_id is not null then 'panel' else 'test' end,
      'item_id',coalesce(ri.test_panel_id,ri.test_definition_id),
      'name',case when ri.test_panel_id is not null then coalesce(tp.name_fa,tp.name) else coalesce(td.name_fa,td.name) end
    ) order by ri.created_at,ri.id
  ),'[]'::jsonb)
  into v_items
  from public.physician_lab_request_items ri
  left join public.test_panels tp on tp.id=ri.test_panel_id
  left join public.test_definitions td on td.id=ri.test_definition_id
  where ri.physician_lab_request_id=v_request.id;

  select * into v_home from public.home_collection_requests h where h.lab_dispatch_id=v_dispatch.id;

  return jsonb_build_object(
    'dispatch_id',v_dispatch.id,
    'request_id',v_request.id,
    'status',v_dispatch.status,
    'branch_id',v_dispatch.laboratory_branch_id,
    'branch_name',v_branch.display_name,
    'branch_city',v_branch.city,
    'patient_id',v_request.patient_id,
    'patient_name',v_patient_name,
    'doctor_id',v_request.doctor_id,
    'doctor_name',v_doctor_name,
    'clinical_note',v_request.clinical_note,
    'lab_order_id',v_dispatch.lab_order_id,
    'requested_home_collection',v_dispatch.requested_home_collection,
    'home_collection_request_id',v_home.id,
    'home_collection_status',v_home.status,
    'ordered_items',v_items,
    'sent_at',v_dispatch.sent_at,
    'responded_at',v_dispatch.responded_at,
    'action_required',v_dispatch.status='pending'
  );
end;
$function$;

revoke all on function "public"."get_lab_dispatch_details"(p_dispatch_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."get_lab_dispatch_details"(p_dispatch_id uuid) to "postgres";

grant execute on function "public"."get_lab_dispatch_details"(p_dispatch_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.get_lab_dispatch_queue(p_status text DEFAULT 'pending'::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_status not in ('pending','accepted','rejected','cancelled','all') then raise exception 'Invalid dispatch status filter'; end if;

  select coalesce(jsonb_agg(
    public.get_lab_dispatch_details(q.id)
      || jsonb_build_object(
        'created_at',q.created_at,
        'updated_at',q.updated_at,
        'response_note',q.response_note,
        'responded_by',q.responded_by
      ) order by q.sent_at desc
  ),'[]'::jsonb)
  into v_result
  from (
    select d.id,d.sent_at,d.created_at,d.updated_at,d.response_note,d.responded_by
    from public.lab_dispatches d
    where public.is_laboratory_branch_member(d.laboratory_branch_id,v_uid)
      and (p_status='all' or d.status=p_status)
    order by d.sent_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
  ) q;

  return v_result;
end;
$function$;

revoke all on function "public"."get_lab_dispatch_queue"(p_status text, p_limit integer) from public,anon,authenticated,service_role;

grant execute on function "public"."get_lab_dispatch_queue"(p_status text, p_limit integer) to "postgres";

grant execute on function "public"."get_lab_dispatch_queue"(p_status text, p_limit integer) to "authenticated";

CREATE OR REPLACE FUNCTION public.get_lab_home_collection_queue(p_status text DEFAULT 'requested'::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_status not in ('requested','approved','rejected','scheduled','dispatched','collected','cancelled','all') then
    raise exception 'Invalid home collection status filter';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',q.id,
      'physician_lab_request_id',q.physician_lab_request_id,
      'lab_dispatch_id',q.lab_dispatch_id,
      'laboratory_branch_id',q.laboratory_branch_id,
      'lab_order_id',q.lab_order_id,
      'patient_id',q.patient_id,
      'doctor_id',q.doctor_id,
      'status',q.status,
      'requested_at',q.requested_at,
      'approved_at',q.approved_at,
      'rejected_at',q.rejected_at,
      'scheduled_for',q.scheduled_for,
      'collector_profile_id',q.collector_profile_id,
      'dispatched_at',q.dispatched_at,
      'collected_at',q.collected_at,
      'cancelled_at',q.cancelled_at,
      'rejection_reason',q.rejection_reason,
      'collection_note',q.collection_note,
      'created_at',q.created_at,
      'updated_at',q.updated_at,
      'dispatch',public.get_lab_dispatch_details(q.lab_dispatch_id)
    ) order by q.requested_at desc
  ),'[]'::jsonb)
  into v_result
  from (
    select h.* from public.home_collection_requests h
    where public.is_laboratory_branch_member(h.laboratory_branch_id,v_uid)
      and (p_status='all' or h.status=p_status)
    order by h.requested_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
  ) q;

  return v_result;
end;
$function$;

revoke all on function "public"."get_lab_home_collection_queue"(p_status text, p_limit integer) from public,anon,authenticated,service_role;

grant execute on function "public"."get_lab_home_collection_queue"(p_status text, p_limit integer) to "postgres";

grant execute on function "public"."get_lab_home_collection_queue"(p_status text, p_limit integer) to "authenticated";

CREATE OR REPLACE FUNCTION public.create_lab_workflow_qr_token(p_target_type text, p_dispatch_id uuid, p_home_collection_request_id uuid, p_token_hash text, p_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_branch_id uuid;
  v_request_doctor uuid;
  v_request_patient uuid;
  v_request_status text;
  v_clinical_request_status text;
  v_order_status text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token hash'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'QR token expiry must be within 7 days';
  end if;

  if p_target_type='dispatch' and p_dispatch_id is not null and p_home_collection_request_id is null then
    select d.laboratory_branch_id,r.doctor_id,r.patient_id,d.status,r.status,lo.status::text
    into v_branch_id,v_request_doctor,v_request_patient,v_request_status,v_clinical_request_status,v_order_status
    from public.lab_dispatches d
    join public.physician_lab_requests r on r.id=d.physician_lab_request_id
    left join public.lab_orders lo on lo.id=d.lab_order_id
    where d.id=p_dispatch_id;

    if not found or v_request_status not in ('pending','accepted')
       or v_clinical_request_status <> 'submitted'
       or (v_request_status='accepted' and (v_order_status is null or v_order_status in ('completed','cancelled'))) then
      raise exception 'Active dispatch not found';
    end if;
    if v_uid not in (v_request_doctor,v_request_patient)
       and not public.is_laboratory_branch_member(v_branch_id,v_uid) then
      raise exception 'Not authorized to issue a dispatch QR token';
    end if;

    update public.lab_workflow_qr_tokens t
    set revoked_at=now()
    where t.target_type='dispatch' and t.dispatch_id=p_dispatch_id and t.revoked_at is null;

  elsif p_target_type='home_collection' and p_dispatch_id is null and p_home_collection_request_id is not null then
    select h.laboratory_branch_id,h.status,h.patient_id,h.doctor_id,d.status::text,lo.status::text
    into v_branch_id,v_request_status,v_request_patient,v_request_doctor,v_clinical_request_status,v_order_status
    from public.home_collection_requests h
    join public.lab_dispatches d on d.id=h.lab_dispatch_id
    left join public.lab_orders lo on lo.id=d.lab_order_id
    where h.id=p_home_collection_request_id;

    if not found or v_request_status not in ('scheduled','dispatched')
       or v_clinical_request_status <> 'accepted'
       or v_order_status is null or v_order_status in ('completed','cancelled') then
      raise exception 'Scheduled home collection with an active laboratory order not found';
    end if;
    if not public.is_laboratory_branch_member(v_branch_id,v_uid) then
      raise exception 'Only the destination laboratory can issue a collection QR token';
    end if;

    update public.lab_workflow_qr_tokens t
    set revoked_at=now()
    where t.target_type='home_collection' and t.home_collection_request_id=p_home_collection_request_id and t.revoked_at is null;
  else
    raise exception 'QR target is invalid';
  end if;

  insert into public.lab_workflow_qr_tokens (
    target_type,dispatch_id,home_collection_request_id,token_hash,created_by,expires_at
  ) values (
    p_target_type,p_dispatch_id,p_home_collection_request_id,p_token_hash,v_uid,p_expires_at
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function "public"."create_lab_workflow_qr_token"(p_target_type text, p_dispatch_id uuid, p_home_collection_request_id uuid, p_token_hash text, p_expires_at timestamp with time zone) from public,anon,authenticated,service_role;

grant execute on function "public"."create_lab_workflow_qr_token"(p_target_type text, p_dispatch_id uuid, p_home_collection_request_id uuid, p_token_hash text, p_expires_at timestamp with time zone) to "postgres";

grant execute on function "public"."create_lab_workflow_qr_token"(p_target_type text, p_dispatch_id uuid, p_home_collection_request_id uuid, p_token_hash text, p_expires_at timestamp with time zone) to "authenticated";

CREATE OR REPLACE FUNCTION public.guard_report_attachment_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NEW.uploaded_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Attachment uploader must equal the current user';
  END IF;

  IF NEW.diagnostic_report_id IS NULL THEN
    RAISE EXCEPTION 'A diagnostic report is required for this attachment';
  END IF;

  IF NEW.file_type IS DISTINCT FROM 'application/pdf' THEN
    RAISE EXCEPTION 'Only PDF report attachments are allowed';
  END IF;

  IF NEW.file_size_bytes IS NULL
     OR NEW.file_size_bytes < 1
     OR NEW.file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'PDF attachment must be between 1 byte and 10 MiB';
  END IF;

  IF NEW.storage_path IS NULL
     OR NEW.storage_path NOT LIKE NEW.uploaded_by::text || '/' || NEW.diagnostic_report_id::text || '/%' THEN
    RAISE EXCEPTION 'Attachment storage path must be scoped to its uploader and report';
  END IF;

  IF NEW.file_name IS NULL
     OR length(btrim(NEW.file_name)) < 1
     OR length(NEW.file_name) > 255 THEN
    RAISE EXCEPTION 'Attachment file name is invalid';
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_report_attachment_metadata"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_report_attachment_metadata"() to "postgres";

CREATE OR REPLACE FUNCTION public.resolve_lab_workflow_qr_token(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_token public.lab_workflow_qr_tokens%rowtype;
  v_dispatch public.lab_dispatches%rowtype;
  v_home public.home_collection_requests%rowtype;
  v_request public.physician_lab_requests%rowtype;
  v_branch_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid QR token'; end if;

  select * into v_token
  from public.lab_workflow_qr_tokens t
  where t.token_hash=p_token_hash and t.revoked_at is null and t.expires_at > now();
  if not found then raise exception 'QR token is invalid or expired'; end if;

  if v_token.target_type='dispatch' then
    select * into v_dispatch from public.lab_dispatches d where d.id=v_token.dispatch_id;
    if not found or not public.is_laboratory_branch_member(v_dispatch.laboratory_branch_id,v_uid) then
      raise exception 'QR request is not assigned to this laboratory account';
    end if;
    select * into v_request
    from public.physician_lab_requests r
    where r.id=v_dispatch.physician_lab_request_id;

    -- Reception only needs the person/order summary. Keep clinical notes and
    -- internal patient/doctor UUIDs out of the QR response payload.
    v_result := (public.get_lab_dispatch_details(v_dispatch.id)
      - 'clinical_note' - 'patient_id' - 'doctor_id')
      || jsonb_build_object('target_type','dispatch','qr_scanned',true);
  elsif v_token.target_type='home_collection' then
    select * into v_home from public.home_collection_requests h where h.id=v_token.home_collection_request_id;
    if not found or not public.is_laboratory_branch_member(v_home.laboratory_branch_id,v_uid) then
      raise exception 'QR request is not assigned to this laboratory account';
    end if;
    select b.id into v_branch_id from public.laboratory_branches b where b.id=v_home.laboratory_branch_id;
    select * into v_dispatch
    from public.lab_dispatches d
    where d.id=v_home.lab_dispatch_id;

    -- Reuse the validated order summary but omit clinical notes and internal IDs.
    -- The home-collection state remains separate from the order state.
    v_result := (public.get_lab_dispatch_details(v_home.lab_dispatch_id)
      - 'clinical_note' - 'patient_id' - 'doctor_id' - 'status')
      || jsonb_build_object(
        'target_type','home_collection',
        'home_collection_request_id',v_home.id,
        'request_id',v_home.physician_lab_request_id,
        'dispatch_id',v_home.lab_dispatch_id,
        'status',v_home.status,
        'dispatch_status',v_dispatch.status,
        'branch_id',v_branch_id,
        'lab_order_id',v_home.lab_order_id,
        'action_required',v_home.status='dispatched',
        'qr_scanned',true
      );
  else
    raise exception 'QR target is invalid';
  end if;

  insert into public.lab_workflow_events(
    actor_id,event_type,entity_type,entity_id,patient_id,doctor_id,
    laboratory_branch_id,physician_lab_request_id,lab_dispatch_id,lab_order_id,
    home_collection_request_id,metadata
  ) values (
    v_uid,'qr.scanned',v_token.target_type,
    coalesce(v_token.dispatch_id,v_token.home_collection_request_id),
    case when v_token.target_type='dispatch' then v_request.patient_id else v_home.patient_id end,
    case when v_token.target_type='dispatch' then v_request.doctor_id else v_home.doctor_id end,
    (v_result->>'branch_id')::uuid,
    (v_result->>'request_id')::uuid,
    case when v_token.target_type='dispatch' then v_token.dispatch_id else v_home.lab_dispatch_id end,
    nullif(v_result->>'lab_order_id','')::uuid,
    v_token.home_collection_request_id,
    jsonb_build_object('target_type',v_token.target_type,'state_change',false)
  );

  return v_result;
end;
$function$;

revoke all on function "public"."resolve_lab_workflow_qr_token"(p_token_hash text) from public,anon,authenticated,service_role;

grant execute on function "public"."resolve_lab_workflow_qr_token"(p_token_hash text) to "postgres";

grant execute on function "public"."resolve_lab_workflow_qr_token"(p_token_hash text) to "authenticated";

CREATE OR REPLACE FUNCTION public.revoke_lab_workflow_qr_tokens(p_dispatch_id uuid DEFAULT NULL::uuid, p_home_collection_request_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_branch_id uuid;
  v_patient_id uuid;
  v_doctor_id uuid;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if (p_dispatch_id is null) = (p_home_collection_request_id is null) then
    raise exception 'Exactly one QR target must be supplied';
  end if;

  if p_dispatch_id is not null then
    select d.laboratory_branch_id,r.patient_id,r.doctor_id
    into v_branch_id,v_patient_id,v_doctor_id
    from public.lab_dispatches d
    join public.physician_lab_requests r on r.id=d.physician_lab_request_id
    where d.id=p_dispatch_id;
    if not found or (v_uid not in (v_patient_id,v_doctor_id)
       and not public.is_laboratory_branch_member(v_branch_id,v_uid)) then
      raise exception 'Not authorized to revoke this QR token';
    end if;
    update public.lab_workflow_qr_tokens t set revoked_at=now()
    where t.target_type='dispatch' and t.dispatch_id=p_dispatch_id and t.revoked_at is null;
  else
    select h.laboratory_branch_id,h.patient_id,h.doctor_id
    into v_branch_id,v_patient_id,v_doctor_id
    from public.home_collection_requests h where h.id=p_home_collection_request_id;
    if not found or (v_uid not in (v_patient_id,v_doctor_id)
       and not public.is_laboratory_branch_member(v_branch_id,v_uid)) then
      raise exception 'Not authorized to revoke this QR token';
    end if;
    update public.lab_workflow_qr_tokens t set revoked_at=now()
    where t.target_type='home_collection' and t.home_collection_request_id=p_home_collection_request_id and t.revoked_at is null;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function "public"."revoke_lab_workflow_qr_tokens"(p_dispatch_id uuid, p_home_collection_request_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."revoke_lab_workflow_qr_tokens"(p_dispatch_id uuid, p_home_collection_request_id uuid) to "postgres";

grant execute on function "public"."revoke_lab_workflow_qr_tokens"(p_dispatch_id uuid, p_home_collection_request_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.audit_lab_workflow_qr_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_dispatch public.lab_dispatches%rowtype;
  v_home public.home_collection_requests%rowtype;
  v_request public.physician_lab_requests%rowtype;
  v_branch_id uuid;
  v_patient_id uuid;
  v_doctor_id uuid;
  v_event_type text;
begin
  if tg_op='UPDATE' then
    if old.revoked_at is not null or new.revoked_at is null then return new; end if;
    v_event_type := 'qr.token_revoked';
  else
    v_event_type := 'qr.token_created';
  end if;

  if new.target_type='dispatch' then
    select * into v_dispatch from public.lab_dispatches d where d.id=new.dispatch_id;
    select * into v_request from public.physician_lab_requests r where r.id=v_dispatch.physician_lab_request_id;
    v_branch_id := v_dispatch.laboratory_branch_id;
    v_patient_id := v_request.patient_id;
    v_doctor_id := v_request.doctor_id;
  else
    select * into v_home from public.home_collection_requests h where h.id=new.home_collection_request_id;
    v_branch_id := v_home.laboratory_branch_id;
    v_patient_id := v_home.patient_id;
    v_doctor_id := v_home.doctor_id;
  end if;

  insert into public.lab_workflow_events(
    actor_id,event_type,entity_type,entity_id,patient_id,doctor_id,
    laboratory_branch_id,physician_lab_request_id,lab_dispatch_id,
    home_collection_request_id,metadata
  ) values (
    case when tg_op='INSERT' then new.created_by else auth.uid() end,
    v_event_type,'lab_workflow_qr_token',new.id,v_patient_id,v_doctor_id,
    v_branch_id,coalesce(v_dispatch.physician_lab_request_id,v_home.physician_lab_request_id),
    new.dispatch_id,new.home_collection_request_id,
    jsonb_build_object('target_type',new.target_type,'expires_at',new.expires_at)
  );
  return new;
end;
$function$;

revoke all on function "public"."audit_lab_workflow_qr_token"() from public,anon,authenticated,service_role;

grant execute on function "public"."audit_lab_workflow_qr_token"() to "postgres";

CREATE OR REPLACE FUNCTION public.notify_physician_lab_request_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op <> 'INSERT' then return new; end if;
  insert into public.notifications(recipient_id,type,title,body,related_entity_type,related_entity_id)
  values (
    new.patient_id,
    'physician_lab_request_created',
    'درخواست آزمایش جدید',
    'پزشک برای شما درخواست آزمایش ثبت کرده است. برای ارسال آن، آزمایشگاه موردنظر خود را انتخاب کنید.',
    'physician_lab_request',
    new.id
  );
  return new;
end;
$function$;

revoke all on function "public"."notify_physician_lab_request_created"() from public,anon,authenticated,service_role;

grant execute on function "public"."notify_physician_lab_request_created"() to "postgres";

CREATE OR REPLACE FUNCTION public.notify_lab_dispatch_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.physician_lab_requests%rowtype;
  v_title text;
  v_body text;
  v_type text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select * into v_request from public.physician_lab_requests r where r.id=new.physician_lab_request_id;

  if tg_op='UPDATE' and new.status in ('rejected','cancelled') then
    update public.lab_workflow_qr_tokens t
    set revoked_at=now()
    where t.target_type='dispatch' and t.dispatch_id=new.id and t.revoked_at is null;
  end if;

  if tg_op='INSERT' then
    insert into public.notifications(recipient_id,type,title,body,related_entity_type,related_entity_id)
    select lbm.profile_id,'lab_dispatch_received','درخواست آزمایش جدید',
      'یک درخواست آزمایش جدید برای شعبه شما ارسال شده است.','lab_dispatch',new.id
    from public.laboratory_branch_members lbm
    where lbm.branch_id=new.laboratory_branch_id and lbm.is_active=true;
    return new;
  end if;

  if new.status='accepted' then
    v_type := 'lab_dispatch_accepted'; v_title := 'درخواست آزمایش پذیرفته شد';
    v_body := 'آزمایشگاه درخواست آزمایش شما را پذیرفته است.';
  elsif new.status='rejected' then
    v_type := 'lab_dispatch_rejected'; v_title := 'درخواست آزمایش پذیرفته نشد';
    v_body := 'آزمایشگاه این درخواست را نپذیرفته است؛ می‌توانید آزمایشگاه دیگری انتخاب کنید.';
  elsif new.status='cancelled' then
    v_type := 'lab_dispatch_cancelled'; v_title := 'ارسال درخواست لغو شد';
    v_body := 'ارسال درخواست آزمایش لغو شده است.';
  else
    return new;
  end if;

  insert into public.notifications(recipient_id,type,title,body,related_entity_type,related_entity_id)
  select distinct recipient_id,v_type,v_title,v_body,'lab_dispatch',new.id
  from (values (v_request.patient_id),(v_request.doctor_id)) recipients(recipient_id)
  where recipient_id is not null;
  return new;
end;
$function$;

revoke all on function "public"."notify_lab_dispatch_transition"() from public,anon,authenticated,service_role;

grant execute on function "public"."notify_lab_dispatch_transition"() to "postgres";

CREATE OR REPLACE FUNCTION public.notify_home_collection_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_title text;
  v_body text;
  v_type text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('rejected','cancelled') then
    update public.lab_workflow_qr_tokens t
    set revoked_at=now()
    where t.target_type='home_collection'
      and t.home_collection_request_id=new.id
      and t.revoked_at is null;
  end if;
  case new.status
    when 'approved' then v_type:='home_collection_approved'; v_title:='نمونه‌گیری در منزل تأیید شد'; v_body:='آزمایشگاه درخواست نمونه‌گیری در منزل را تأیید کرده است.';
    when 'rejected' then v_type:='home_collection_rejected'; v_title:='نمونه‌گیری در منزل پذیرفته نشد'; v_body:='آزمایشگاه امکان نمونه‌گیری در منزل را نپذیرفته است.';
    when 'scheduled' then v_type:='home_collection_scheduled'; v_title:='زمان نمونه‌گیری مشخص شد'; v_body:='زمان مراجعه برای نمونه‌گیری در منزل مشخص شده است.';
    when 'dispatched' then v_type:='home_collection_dispatched'; v_title:='نمونه‌گیر اعزام شد'; v_body:='نمونه‌گیر برای مراجعه به نشانی ثبت‌شده اعزام شده است.';
    when 'collected' then v_type:='home_collection_collected'; v_title:='نمونه دریافت شد'; v_body:='نمونه شما دریافت شده است.';
    when 'cancelled' then v_type:='home_collection_cancelled'; v_title:='درخواست نمونه‌گیری لغو شد'; v_body:='درخواست نمونه‌گیری در منزل لغو شده است.';
    else return new;
  end case;

  insert into public.notifications(recipient_id,type,title,body,related_entity_type,related_entity_id)
  values (new.patient_id,v_type,v_title,v_body,'home_collection_request',new.id);
  return new;
end;
$function$;

revoke all on function "public"."notify_home_collection_transition"() from public,anon,authenticated,service_role;

grant execute on function "public"."notify_home_collection_transition"() to "postgres";

CREATE OR REPLACE FUNCTION private.audit_profiles_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_changed_fields text[] := ARRAY[]::text[];
begin
  if v_uid is null then return new; end if;

  if new.full_name is distinct from old.full_name then
    v_changed_fields := array_append(v_changed_fields, 'full_name');
  end if;
  if new.avatar_url is distinct from old.avatar_url then
    v_changed_fields := array_append(v_changed_fields, 'avatar_url');
  end if;

  if cardinality(v_changed_fields) > 0 then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      v_uid, 'profile_updated', 'profile', new.id,
      jsonb_build_object('changed_fields', to_jsonb(v_changed_fields), 'source', 'database_trigger')
    );
  end if;

  return new;
end;
$function$;

revoke all on function "private"."audit_profiles_update"() from public,anon,authenticated,service_role;

grant execute on function "private"."audit_profiles_update"() to "postgres";

CREATE OR REPLACE FUNCTION private.audit_patient_profiles_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_changed_fields text[] := ARRAY[]::text[];
begin
  if v_uid is null then return new; end if;

  IF TG_OP = 'INSERT' THEN
    v_changed_fields := ARRAY[
      'date_of_birth', 'sex', 'blood_type',
      'emergency_contact_name', 'emergency_contact_phone'
    ]::text[];
  ELSE
    if new.date_of_birth is distinct from old.date_of_birth then
      v_changed_fields := array_append(v_changed_fields, 'date_of_birth');
    end if;
    if new.sex is distinct from old.sex then
      v_changed_fields := array_append(v_changed_fields, 'sex');
    end if;
    if new.blood_type is distinct from old.blood_type then
      v_changed_fields := array_append(v_changed_fields, 'blood_type');
    end if;
    if new.emergency_contact_name is distinct from old.emergency_contact_name then
      v_changed_fields := array_append(v_changed_fields, 'emergency_contact_name');
    end if;
    if new.emergency_contact_phone is distinct from old.emergency_contact_phone then
      v_changed_fields := array_append(v_changed_fields, 'emergency_contact_phone');
    end if;
  END IF;

  if cardinality(v_changed_fields) > 0 then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      v_uid, 'profile_updated', 'patient_profile', new.id,
      jsonb_build_object('changed_fields', to_jsonb(v_changed_fields), 'source', 'database_trigger')
    );
  end if;

  return new;
end;
$function$;

revoke all on function "private"."audit_patient_profiles_update"() from public,anon,authenticated,service_role;

grant execute on function "private"."audit_patient_profiles_update"() to "postgres";

CREATE OR REPLACE FUNCTION public.save_lab_results_atomic(p_order_id uuid, p_report_id uuid, p_observations jsonb, p_finalize boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.lab_orders%rowtype;
  v_report public.diagnostic_reports%rowtype;
  v_item jsonb;
  v_test_id uuid;
  v_test_type text;
  v_allows_negative boolean;
  v_required boolean;
  v_has_value boolean;
  v_numeric numeric;
  v_text text;
  v_boolean boolean;
  v_existing public.observations%rowtype;
  v_expected_count integer;
  v_input_count integer;
  v_seen_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.laboratory_profiles lp ON lp.id = p.id
    WHERE p.id = v_uid
      AND p.role = 'laboratory'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Laboratory account required';
  END IF;

  IF p_order_id IS NULL OR jsonb_typeof(p_observations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid laboratory result payload';
  END IF;

  -- Serialize workflow writes for the same order and authorize by the order's
  -- direct owner or active destination-branch membership. Reception-only
  -- memberships may not enter or finalize results.
  SELECT lo.* INTO v_order
  FROM public.lab_orders lo
  WHERE lo.id = p_order_id
    AND lo.status = 'in_progress'::public.order_status
    AND (
      lo.laboratory_id = v_uid
      OR (
        lo.laboratory_branch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.laboratory_branch_members lbm
          WHERE lbm.branch_id = lo.laboratory_branch_id
            AND lbm.profile_id = v_uid
            AND lbm.is_active = true
            AND lbm.role_in_branch IN ('manager', 'laboratory_staff', 'member')
        )
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'In-progress laboratory order not found or access denied';
  END IF;

  -- One report per order is enforced by the existing unique index. If it
  -- exists, it must still be a draft; otherwise fail closed.
  SELECT dr.* INTO v_report
  FROM public.diagnostic_reports dr
  WHERE dr.lab_order_id = v_order.id
  FOR UPDATE;

  IF FOUND THEN
    IF p_report_id IS NOT NULL AND p_report_id IS DISTINCT FROM v_report.id THEN
      RAISE EXCEPTION 'Report does not belong to this order';
    END IF;
    IF v_report.status <> 'draft'::public.report_status THEN
      RAISE EXCEPTION 'Only a draft report can receive preliminary results';
    END IF;
    IF NOT (
      v_report.laboratory_id = v_uid
      OR v_order.laboratory_id = v_uid
      OR (
        v_order.laboratory_branch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.laboratory_branch_members lbm
          WHERE lbm.branch_id = v_order.laboratory_branch_id
            AND lbm.profile_id = v_uid
            AND lbm.is_active = true
            AND lbm.role_in_branch IN ('manager', 'laboratory_staff', 'member')
        )
      )
    ) THEN
      RAISE EXCEPTION 'Not authorized to edit this report';
    END IF;
  ELSE
    IF p_report_id IS NOT NULL THEN
      RAISE EXCEPTION 'Requested report was not found';
    END IF;

    INSERT INTO public.diagnostic_reports (
      lab_order_id, laboratory_id, status, entered_by
    ) VALUES (
      v_order.id, v_uid, 'draft'::public.report_status, v_uid
    )
    RETURNING * INTO v_report;
  END IF;

  -- Derive the expected test set from this order, not from caller claims.
  SELECT count(*) INTO v_expected_count
  FROM (
    SELECT loi.test_definition_id AS test_id
    FROM public.lab_order_items loi
    WHERE loi.lab_order_id = v_order.id
      AND loi.test_definition_id IS NOT NULL
    UNION
    SELECT tpi.test_definition_id AS test_id
    FROM public.lab_order_items loi
    JOIN public.test_panel_items tpi ON tpi.panel_id = loi.test_panel_id
    WHERE loi.lab_order_id = v_order.id
      AND tpi.test_definition_id IS NOT NULL
  ) expected;

  IF v_expected_count = 0 THEN
    RAISE EXCEPTION 'No tests are configured for this order';
  END IF;

  SELECT count(*) INTO v_input_count FROM jsonb_array_elements(p_observations);
  IF v_input_count <> v_expected_count THEN
    RAISE EXCEPTION 'Payload must contain exactly one row for every ordered test';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT elem.value ->> 'test_definition_id' AS test_id
      FROM jsonb_array_elements(p_observations) elem
      GROUP BY elem.value ->> 'test_definition_id'
      HAVING count(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'A test may appear only once in a result payload';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT elem.value ->> 'test_definition_id' AS test_id
      FROM jsonb_array_elements(p_observations) elem
    ) supplied
    WHERE supplied.test_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM (
           SELECT loi.test_definition_id AS test_id
           FROM public.lab_order_items loi
           WHERE loi.lab_order_id = v_order.id
             AND loi.test_definition_id IS NOT NULL
           UNION
           SELECT tpi.test_definition_id
           FROM public.lab_order_items loi
           JOIN public.test_panel_items tpi ON tpi.panel_id = loi.test_panel_id
           WHERE loi.lab_order_id = v_order.id
             AND tpi.test_definition_id IS NOT NULL
         ) expected
         WHERE expected.test_id::text = supplied.test_id
       )
  ) THEN
    RAISE EXCEPTION 'Payload contains a test not included in this order';
  END IF;

  -- All writes remain in this function's single transaction. Any validation,
  -- constraint, trigger, or finalization error rolls back every prior change.
  FOR v_item IN SELECT elem.value FROM jsonb_array_elements(p_observations) elem
  LOOP
    BEGIN
      v_test_id := nullif(v_item ->> 'test_definition_id', '')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid test_definition_id in result payload';
    END;

    IF jsonb_typeof(v_item -> 'has_value') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Each test row must specify has_value';
    END IF;
    v_has_value := (v_item ->> 'has_value')::boolean;

    SELECT td.value_type, td.allows_negative,
           bool_or(expected.is_required)
    INTO v_test_type, v_allows_negative, v_required
    FROM public.test_definitions td
    JOIN (
      SELECT loi.test_definition_id AS test_id, true AS is_required
      FROM public.lab_order_items loi
      WHERE loi.lab_order_id = v_order.id
        AND loi.test_definition_id IS NOT NULL
      UNION ALL
      SELECT tpi.test_definition_id AS test_id, coalesce(tpi.is_required, true) AS is_required
      FROM public.lab_order_items loi
      JOIN public.test_panel_items tpi ON tpi.panel_id = loi.test_panel_id
      WHERE loi.lab_order_id = v_order.id
        AND tpi.test_definition_id IS NOT NULL
    ) expected ON expected.test_id = td.id
    WHERE td.id = v_test_id
    GROUP BY td.value_type, td.allows_negative;

    IF v_test_type IS NULL THEN
      RAISE EXCEPTION 'Ordered test definition not found';
    END IF;

    v_numeric := NULL;
    v_text := NULL;
    v_boolean := NULL;

    IF NOT v_has_value THEN
      IF v_required THEN
        RAISE EXCEPTION 'Required test result is missing';
      END IF;
      IF coalesce(jsonb_typeof(v_item -> 'value_numeric'), 'null') <> 'null'
         OR coalesce(jsonb_typeof(v_item -> 'value_text'), 'null') <> 'null'
         OR coalesce(jsonb_typeof(v_item -> 'value_boolean'), 'null') <> 'null' THEN
        RAISE EXCEPTION 'Blank test rows must not contain a typed value';
      END IF;
    ELSIF v_test_type = 'numeric' THEN
      IF jsonb_typeof(v_item -> 'value_numeric') IS DISTINCT FROM 'number'
         OR coalesce(jsonb_typeof(v_item -> 'value_text'), 'null') <> 'null'
         OR coalesce(jsonb_typeof(v_item -> 'value_boolean'), 'null') <> 'null' THEN
        RAISE EXCEPTION 'Numeric test requires only value_numeric';
      END IF;
      v_numeric := (v_item ->> 'value_numeric')::numeric;
      IF v_numeric < 0 AND NOT v_allows_negative THEN
        RAISE EXCEPTION 'Negative value is not allowed for this test';
      END IF;
    ELSIF v_test_type = 'text' THEN
      IF jsonb_typeof(v_item -> 'value_text') IS DISTINCT FROM 'string'
         OR length(btrim(coalesce(v_item ->> 'value_text', ''))) = 0
         OR length(btrim(coalesce(v_item ->> 'value_text', ''))) > 1000
         OR coalesce(jsonb_typeof(v_item -> 'value_numeric'), 'null') <> 'null'
         OR coalesce(jsonb_typeof(v_item -> 'value_boolean'), 'null') <> 'null' THEN
        RAISE EXCEPTION 'Text test requires a non-empty value_text of at most 1000 characters';
      END IF;
      v_text := btrim(v_item ->> 'value_text');
    ELSIF v_test_type = 'boolean' THEN
      IF jsonb_typeof(v_item -> 'value_boolean') IS DISTINCT FROM 'boolean'
         OR coalesce(jsonb_typeof(v_item -> 'value_numeric'), 'null') <> 'null'
         OR coalesce(jsonb_typeof(v_item -> 'value_text'), 'null') <> 'null' THEN
        RAISE EXCEPTION 'Boolean test requires only value_boolean';
      END IF;
      v_boolean := (v_item ->> 'value_boolean')::boolean;
    ELSE
      RAISE EXCEPTION 'Unsupported test value type';
    END IF;

    SELECT o.* INTO v_existing
    FROM public.observations o
    WHERE o.diagnostic_report_id = v_report.id
      AND o.test_definition_id = v_test_id
      AND o.status <> 'superseded'::public.observation_status
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT v_has_value THEN
      IF FOUND THEN
        IF v_existing.status <> 'preliminary'::public.observation_status THEN
          RAISE EXCEPTION 'A non-draft result cannot be cleared through draft editing';
        END IF;
        UPDATE public.observations
        SET status = 'superseded'::public.observation_status
        WHERE id = v_existing.id;
      END IF;
      v_seen_count := v_seen_count + 1;
      CONTINUE;
    END IF;

    IF FOUND THEN
      IF v_existing.status <> 'preliminary'::public.observation_status THEN
        RAISE EXCEPTION 'A finalized result cannot be edited directly';
      END IF;
      IF v_existing.value_numeric IS NOT DISTINCT FROM v_numeric
         AND v_existing.value_text IS NOT DISTINCT FROM v_text
         AND v_existing.value_boolean IS NOT DISTINCT FROM v_boolean THEN
        v_seen_count := v_seen_count + 1;
        CONTINUE;
      END IF;
      UPDATE public.observations
      SET status = 'superseded'::public.observation_status
      WHERE id = v_existing.id;
    END IF;

    INSERT INTO public.observations (
      diagnostic_report_id, test_definition_id,
      value_numeric, value_text, value_boolean,
      unit, flag, status, supersedes_observation_id, entered_by
    ) VALUES (
      v_report.id, v_test_id,
      v_numeric, v_text, v_boolean,
      '', 'unknown'::public.flag_status,
      'preliminary'::public.observation_status, NULL, v_uid
    );

    v_seen_count := v_seen_count + 1;
  END LOOP;

  IF v_seen_count <> v_expected_count THEN
    RAISE EXCEPTION 'Not all ordered tests were processed';
  END IF;

  IF p_finalize THEN
    PERFORM public.finalize_lab_report(v_report.id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'report_id', v_report.id,
    'status', CASE WHEN p_finalize THEN 'final' ELSE 'draft' END
  );
END;
$function$;

revoke all on function "public"."save_lab_results_atomic"(p_order_id uuid, p_report_id uuid, p_observations jsonb, p_finalize boolean) from public,anon,authenticated,service_role;

grant execute on function "public"."save_lab_results_atomic"(p_order_id uuid, p_report_id uuid, p_observations jsonb, p_finalize boolean) to "postgres";

grant execute on function "public"."save_lab_results_atomic"(p_order_id uuid, p_report_id uuid, p_observations jsonb, p_finalize boolean) to "authenticated";

CREATE OR REPLACE FUNCTION public.guard_laboratory_branch_order_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_branch_role text;
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF TG_OP <> 'UPDATE' OR NEW.laboratory_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lbm.role_in_branch INTO v_branch_role
  FROM public.laboratory_branch_members lbm
  WHERE lbm.branch_id = OLD.laboratory_branch_id
    AND lbm.profile_id = auth.uid()
    AND lbm.is_active = true;

  IF v_branch_role = 'reception'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       OLD.status = 'pending'::public.order_status
       AND NEW.status = 'received_by_lab'::public.order_status
       AND NEW.received_at IS NOT NULL
       AND NEW.completed_at IS NULL
       AND NEW.cancelled_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Reception members may only mark pending orders as received';
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_laboratory_branch_order_role"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_laboratory_branch_order_role"() to "postgres";

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
      prescription_id, medication_name, dosage, frequency, duration, instructions
    ) VALUES (
      v_prescription_id, v_medication_name, v_dosage, v_frequency, v_duration, v_instructions
    );
  END LOOP;

  RETURN v_prescription_id;
END;
$function$;

revoke all on function "public"."create_prescription_with_items"(p_patient_id uuid, p_diagnostic_report_id uuid, p_items jsonb) from public,anon,authenticated,service_role;

grant execute on function "public"."create_prescription_with_items"(p_patient_id uuid, p_diagnostic_report_id uuid, p_items jsonb) to "postgres";

grant execute on function "public"."create_prescription_with_items"(p_patient_id uuid, p_diagnostic_report_id uuid, p_items jsonb) to "authenticated";

CREATE OR REPLACE FUNCTION public.is_laboratory_branch_result_member(p_branch_id uuid, p_profile_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT p_profile_id IS NOT DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.laboratory_branch_members lbm
      WHERE lbm.branch_id = p_branch_id
        AND lbm.profile_id = auth.uid()
        AND lbm.is_active = true
        AND lbm.role_in_branch IN ('manager', 'laboratory_staff', 'member')
    );
$function$;

revoke all on function "public"."is_laboratory_branch_result_member"(p_branch_id uuid, p_profile_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."is_laboratory_branch_result_member"(p_branch_id uuid, p_profile_id uuid) to "postgres";

grant execute on function "public"."is_laboratory_branch_result_member"(p_branch_id uuid, p_profile_id uuid) to "authenticated";

CREATE OR REPLACE FUNCTION public.guard_laboratory_branch_result_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_branch_id uuid;
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF TG_TABLE_NAME = 'diagnostic_reports' THEN
    SELECT lo.laboratory_branch_id INTO v_branch_id
    FROM public.lab_orders lo
    WHERE lo.id = NEW.lab_order_id;
  ELSE
    SELECT lo.laboratory_branch_id INTO v_branch_id
    FROM public.observations o
    JOIN public.diagnostic_reports dr ON dr.id = o.diagnostic_report_id
    JOIN public.lab_orders lo ON lo.id = dr.lab_order_id
    WHERE o.id = NEW.id;

    -- On INSERT, NEW.id may be generated by the database and is not yet
    -- present. Resolve the parent report/order directly in that case.
    IF v_branch_id IS NULL THEN
      SELECT lo.laboratory_branch_id INTO v_branch_id
      FROM public.diagnostic_reports dr
      JOIN public.lab_orders lo ON lo.id = dr.lab_order_id
      WHERE dr.id = NEW.diagnostic_report_id;
    END IF;
  END IF;

  IF v_branch_id IS NOT NULL
     AND NOT public.is_laboratory_branch_result_member(v_branch_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only laboratory staff may create or change report results';
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function "public"."guard_laboratory_branch_result_role"() from public,anon,authenticated,service_role;

grant execute on function "public"."guard_laboratory_branch_result_role"() to "postgres";

CREATE OR REPLACE FUNCTION public.touch_guest_result_access(p_access_id uuid)
 RETURNS TABLE(access_count integer, last_accessed_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  UPDATE public.guest_result_accesses AS access
  SET access_count = coalesce(access.access_count, 0) + 1,
      last_accessed_at = now()
  WHERE access.id = p_access_id
    AND access.revoked_at IS NULL
    AND access.expires_at > now()
    AND EXISTS (
      SELECT 1
      FROM public.diagnostic_reports dr
      WHERE dr.id = access.diagnostic_report_id
        AND dr.status IN ('final'::public.report_status, 'amended'::public.report_status)
    )
  RETURNING access.access_count, access.last_accessed_at;
$function$;

revoke all on function "public"."touch_guest_result_access"(p_access_id uuid) from public,anon,authenticated,service_role;

grant execute on function "public"."touch_guest_result_access"(p_access_id uuid) to "postgres";

grant execute on function "public"."touch_guest_result_access"(p_access_id uuid) to "service_role";

alter table public."guest_result_accesses" enable row level security;

alter table public."profiles" enable row level security;

alter table public."doctor_profiles" enable row level security;

alter table public."patient_profiles" enable row level security;

alter table public."organizations" enable row level security;

alter table public."organization_members" enable row level security;

alter table public."laboratory_profiles" enable row level security;

alter table public."patient_doctor_relationships" enable row level security;

alter table public."test_definitions" enable row level security;

alter table public."test_aliases" enable row level security;

alter table public."test_panels" enable row level security;

alter table public."test_panel_items" enable row level security;

alter table public."reference_range_templates" enable row level security;

alter table public."lab_orders" enable row level security;

alter table public."observations" enable row level security;

alter table public."doctor_interpretations" enable row level security;

alter table public."diagnostic_reports" enable row level security;

alter table public."doctor_notes" enable row level security;

alter table public."prescriptions" enable row level security;

alter table public."lab_dispatches" enable row level security;

alter table public."physician_lab_requests" enable row level security;

alter table public."notifications" enable row level security;

alter table public."prescription_items" enable row level security;

alter table public."ai_analyses" enable row level security;

alter table public."trend_analyses" enable row level security;

alter table public."laboratory_branches" enable row level security;

alter table public."laboratory_branch_members" enable row level security;

alter table public."physician_lab_request_items" enable row level security;

alter table public."home_collection_requests" enable row level security;

alter table public."home_collection_private_details" enable row level security;

alter table public."lab_order_items" enable row level security;

alter table public."attachments" enable row level security;

alter table public."audit_logs" enable row level security;

alter table public."lab_workflow_qr_tokens" enable row level security;

alter table public."lab_workflow_events" enable row level security;

alter table public."consents" enable row level security;

alter table public."admin_profiles" enable row level security;

alter table public."follow_ups" enable row level security;

alter table public."voice_notes" enable row level security;

alter table public."visits" enable row level security;

alter table public."transcripts" enable row level security;

alter table public."visit_summaries" enable row level security;

grant INSERT on public."guest_result_accesses" to "authenticated";

grant SELECT on public."guest_result_accesses" to "authenticated";

grant UPDATE on public."guest_result_accesses" to "authenticated";

grant TRUNCATE on public."profiles" to "anon";

grant REFERENCES on public."profiles" to "anon";

grant TRIGGER on public."profiles" to "anon";

grant INSERT on public."profiles" to "authenticated";

grant SELECT on public."profiles" to "authenticated";

grant UPDATE on public."profiles" to "authenticated";

grant TRUNCATE on public."profiles" to "authenticated";

grant REFERENCES on public."profiles" to "authenticated";

grant TRIGGER on public."profiles" to "authenticated";

grant TRUNCATE on public."doctor_profiles" to "anon";

grant REFERENCES on public."doctor_profiles" to "anon";

grant TRIGGER on public."doctor_profiles" to "anon";

grant SELECT on public."doctor_profiles" to "authenticated";

grant TRUNCATE on public."doctor_profiles" to "authenticated";

grant REFERENCES on public."doctor_profiles" to "authenticated";

grant TRIGGER on public."doctor_profiles" to "authenticated";

grant TRUNCATE on public."patient_profiles" to "anon";

grant REFERENCES on public."patient_profiles" to "anon";

grant TRIGGER on public."patient_profiles" to "anon";

grant INSERT on public."patient_profiles" to "authenticated";

grant SELECT on public."patient_profiles" to "authenticated";

grant UPDATE on public."patient_profiles" to "authenticated";

grant TRUNCATE on public."patient_profiles" to "authenticated";

grant REFERENCES on public."patient_profiles" to "authenticated";

grant TRIGGER on public."patient_profiles" to "authenticated";

grant TRUNCATE on public."organizations" to "anon";

grant REFERENCES on public."organizations" to "anon";

grant TRIGGER on public."organizations" to "anon";

grant SELECT on public."organizations" to "authenticated";

grant TRUNCATE on public."organizations" to "authenticated";

grant REFERENCES on public."organizations" to "authenticated";

grant TRIGGER on public."organizations" to "authenticated";

grant TRUNCATE on public."organization_members" to "anon";

grant REFERENCES on public."organization_members" to "anon";

grant TRIGGER on public."organization_members" to "anon";

grant SELECT on public."organization_members" to "authenticated";

grant TRUNCATE on public."organization_members" to "authenticated";

grant REFERENCES on public."organization_members" to "authenticated";

grant TRIGGER on public."organization_members" to "authenticated";

grant TRUNCATE on public."laboratory_profiles" to "anon";

grant REFERENCES on public."laboratory_profiles" to "anon";

grant TRIGGER on public."laboratory_profiles" to "anon";

grant SELECT on public."laboratory_profiles" to "authenticated";

grant TRUNCATE on public."laboratory_profiles" to "authenticated";

grant REFERENCES on public."laboratory_profiles" to "authenticated";

grant TRIGGER on public."laboratory_profiles" to "authenticated";

grant TRUNCATE on public."patient_doctor_relationships" to "anon";

grant REFERENCES on public."patient_doctor_relationships" to "anon";

grant TRIGGER on public."patient_doctor_relationships" to "anon";

grant INSERT on public."patient_doctor_relationships" to "authenticated";

grant SELECT on public."patient_doctor_relationships" to "authenticated";

grant UPDATE on public."patient_doctor_relationships" to "authenticated";

grant TRUNCATE on public."patient_doctor_relationships" to "authenticated";

grant REFERENCES on public."patient_doctor_relationships" to "authenticated";

grant TRIGGER on public."patient_doctor_relationships" to "authenticated";

grant TRUNCATE on public."test_definitions" to "anon";

grant REFERENCES on public."test_definitions" to "anon";

grant TRIGGER on public."test_definitions" to "anon";

grant SELECT on public."test_definitions" to "authenticated";

grant TRUNCATE on public."test_definitions" to "authenticated";

grant REFERENCES on public."test_definitions" to "authenticated";

grant TRIGGER on public."test_definitions" to "authenticated";

grant TRUNCATE on public."test_aliases" to "anon";

grant REFERENCES on public."test_aliases" to "anon";

grant TRIGGER on public."test_aliases" to "anon";

grant SELECT on public."test_aliases" to "authenticated";

grant TRUNCATE on public."test_aliases" to "authenticated";

grant REFERENCES on public."test_aliases" to "authenticated";

grant TRIGGER on public."test_aliases" to "authenticated";

grant TRUNCATE on public."test_panels" to "anon";

grant REFERENCES on public."test_panels" to "anon";

grant TRIGGER on public."test_panels" to "anon";

grant SELECT on public."test_panels" to "authenticated";

grant TRUNCATE on public."test_panels" to "authenticated";

grant REFERENCES on public."test_panels" to "authenticated";

grant TRIGGER on public."test_panels" to "authenticated";

grant TRUNCATE on public."test_panel_items" to "anon";

grant REFERENCES on public."test_panel_items" to "anon";

grant TRIGGER on public."test_panel_items" to "anon";

grant SELECT on public."test_panel_items" to "authenticated";

grant TRUNCATE on public."test_panel_items" to "authenticated";

grant REFERENCES on public."test_panel_items" to "authenticated";

grant TRIGGER on public."test_panel_items" to "authenticated";

grant TRUNCATE on public."reference_range_templates" to "anon";

grant REFERENCES on public."reference_range_templates" to "anon";

grant TRIGGER on public."reference_range_templates" to "anon";

grant INSERT on public."reference_range_templates" to "authenticated";

grant SELECT on public."reference_range_templates" to "authenticated";

grant UPDATE on public."reference_range_templates" to "authenticated";

grant DELETE on public."reference_range_templates" to "authenticated";

grant TRUNCATE on public."reference_range_templates" to "authenticated";

grant REFERENCES on public."reference_range_templates" to "authenticated";

grant TRIGGER on public."reference_range_templates" to "authenticated";

grant TRUNCATE on public."lab_orders" to "anon";

grant REFERENCES on public."lab_orders" to "anon";

grant TRIGGER on public."lab_orders" to "anon";

grant INSERT on public."lab_orders" to "authenticated";

grant SELECT on public."lab_orders" to "authenticated";

grant UPDATE on public."lab_orders" to "authenticated";

grant TRUNCATE on public."lab_orders" to "authenticated";

grant REFERENCES on public."lab_orders" to "authenticated";

grant TRIGGER on public."lab_orders" to "authenticated";

grant TRUNCATE on public."observations" to "anon";

grant REFERENCES on public."observations" to "anon";

grant TRIGGER on public."observations" to "anon";

grant INSERT on public."observations" to "authenticated";

grant SELECT on public."observations" to "authenticated";

grant UPDATE on public."observations" to "authenticated";

grant TRUNCATE on public."observations" to "authenticated";

grant REFERENCES on public."observations" to "authenticated";

grant TRIGGER on public."observations" to "authenticated";

grant TRUNCATE on public."doctor_interpretations" to "anon";

grant REFERENCES on public."doctor_interpretations" to "anon";

grant TRIGGER on public."doctor_interpretations" to "anon";

grant INSERT on public."doctor_interpretations" to "authenticated";

grant SELECT on public."doctor_interpretations" to "authenticated";

grant UPDATE on public."doctor_interpretations" to "authenticated";

grant TRUNCATE on public."doctor_interpretations" to "authenticated";

grant REFERENCES on public."doctor_interpretations" to "authenticated";

grant TRIGGER on public."doctor_interpretations" to "authenticated";

grant TRUNCATE on public."diagnostic_reports" to "anon";

grant REFERENCES on public."diagnostic_reports" to "anon";

grant TRIGGER on public."diagnostic_reports" to "anon";

grant INSERT on public."diagnostic_reports" to "authenticated";

grant SELECT on public."diagnostic_reports" to "authenticated";

grant UPDATE on public."diagnostic_reports" to "authenticated";

grant TRUNCATE on public."diagnostic_reports" to "authenticated";

grant REFERENCES on public."diagnostic_reports" to "authenticated";

grant TRIGGER on public."diagnostic_reports" to "authenticated";

grant TRUNCATE on public."doctor_notes" to "anon";

grant REFERENCES on public."doctor_notes" to "anon";

grant TRIGGER on public."doctor_notes" to "anon";

grant INSERT on public."doctor_notes" to "authenticated";

grant SELECT on public."doctor_notes" to "authenticated";

grant UPDATE on public."doctor_notes" to "authenticated";

grant TRUNCATE on public."doctor_notes" to "authenticated";

grant REFERENCES on public."doctor_notes" to "authenticated";

grant TRIGGER on public."doctor_notes" to "authenticated";

grant TRUNCATE on public."prescriptions" to "anon";

grant REFERENCES on public."prescriptions" to "anon";

grant TRIGGER on public."prescriptions" to "anon";

grant INSERT on public."prescriptions" to "authenticated";

grant SELECT on public."prescriptions" to "authenticated";

grant UPDATE on public."prescriptions" to "authenticated";

grant TRUNCATE on public."prescriptions" to "authenticated";

grant REFERENCES on public."prescriptions" to "authenticated";

grant TRIGGER on public."prescriptions" to "authenticated";

grant TRUNCATE on public."lab_dispatches" to "anon";

grant REFERENCES on public."lab_dispatches" to "anon";

grant TRIGGER on public."lab_dispatches" to "anon";

grant SELECT on public."lab_dispatches" to "authenticated";

grant TRUNCATE on public."lab_dispatches" to "authenticated";

grant REFERENCES on public."lab_dispatches" to "authenticated";

grant TRIGGER on public."lab_dispatches" to "authenticated";

grant TRUNCATE on public."physician_lab_requests" to "anon";

grant REFERENCES on public."physician_lab_requests" to "anon";

grant TRIGGER on public."physician_lab_requests" to "anon";

grant SELECT on public."physician_lab_requests" to "authenticated";

grant TRUNCATE on public."physician_lab_requests" to "authenticated";

grant REFERENCES on public."physician_lab_requests" to "authenticated";

grant TRIGGER on public."physician_lab_requests" to "authenticated";

grant TRUNCATE on public."notifications" to "anon";

grant REFERENCES on public."notifications" to "anon";

grant TRIGGER on public."notifications" to "anon";

grant SELECT on public."notifications" to "authenticated";

grant UPDATE on public."notifications" to "authenticated";

grant TRUNCATE on public."notifications" to "authenticated";

grant REFERENCES on public."notifications" to "authenticated";

grant TRIGGER on public."notifications" to "authenticated";

grant TRUNCATE on public."prescription_items" to "anon";

grant REFERENCES on public."prescription_items" to "anon";

grant TRIGGER on public."prescription_items" to "anon";

grant INSERT on public."prescription_items" to "authenticated";

grant SELECT on public."prescription_items" to "authenticated";

grant TRUNCATE on public."prescription_items" to "authenticated";

grant REFERENCES on public."prescription_items" to "authenticated";

grant TRIGGER on public."prescription_items" to "authenticated";

grant TRUNCATE on public."ai_analyses" to "anon";

grant REFERENCES on public."ai_analyses" to "anon";

grant TRIGGER on public."ai_analyses" to "anon";

grant SELECT on public."ai_analyses" to "authenticated";

grant UPDATE on public."ai_analyses" to "authenticated";

grant TRUNCATE on public."ai_analyses" to "authenticated";

grant REFERENCES on public."ai_analyses" to "authenticated";

grant TRIGGER on public."ai_analyses" to "authenticated";

grant TRUNCATE on public."trend_analyses" to "anon";

grant REFERENCES on public."trend_analyses" to "anon";

grant TRIGGER on public."trend_analyses" to "anon";

grant SELECT on public."trend_analyses" to "authenticated";

grant TRUNCATE on public."trend_analyses" to "authenticated";

grant REFERENCES on public."trend_analyses" to "authenticated";

grant TRIGGER on public."trend_analyses" to "authenticated";

grant TRUNCATE on public."laboratory_branches" to "anon";

grant REFERENCES on public."laboratory_branches" to "anon";

grant TRIGGER on public."laboratory_branches" to "anon";

grant SELECT on public."laboratory_branches" to "authenticated";

grant TRUNCATE on public."laboratory_branches" to "authenticated";

grant REFERENCES on public."laboratory_branches" to "authenticated";

grant TRIGGER on public."laboratory_branches" to "authenticated";

grant TRUNCATE on public."laboratory_branch_members" to "anon";

grant REFERENCES on public."laboratory_branch_members" to "anon";

grant TRIGGER on public."laboratory_branch_members" to "anon";

grant SELECT on public."laboratory_branch_members" to "authenticated";

grant TRUNCATE on public."laboratory_branch_members" to "authenticated";

grant REFERENCES on public."laboratory_branch_members" to "authenticated";

grant TRIGGER on public."laboratory_branch_members" to "authenticated";

grant TRUNCATE on public."physician_lab_request_items" to "anon";

grant REFERENCES on public."physician_lab_request_items" to "anon";

grant TRIGGER on public."physician_lab_request_items" to "anon";

grant SELECT on public."physician_lab_request_items" to "authenticated";

grant TRUNCATE on public."physician_lab_request_items" to "authenticated";

grant REFERENCES on public."physician_lab_request_items" to "authenticated";

grant TRIGGER on public."physician_lab_request_items" to "authenticated";

grant TRUNCATE on public."home_collection_requests" to "anon";

grant REFERENCES on public."home_collection_requests" to "anon";

grant TRIGGER on public."home_collection_requests" to "anon";

grant SELECT on public."home_collection_requests" to "authenticated";

grant TRUNCATE on public."home_collection_requests" to "authenticated";

grant REFERENCES on public."home_collection_requests" to "authenticated";

grant TRIGGER on public."home_collection_requests" to "authenticated";

grant TRUNCATE on public."home_collection_private_details" to "anon";

grant REFERENCES on public."home_collection_private_details" to "anon";

grant TRIGGER on public."home_collection_private_details" to "anon";

grant TRUNCATE on public."home_collection_private_details" to "authenticated";

grant REFERENCES on public."home_collection_private_details" to "authenticated";

grant TRIGGER on public."home_collection_private_details" to "authenticated";

grant TRUNCATE on public."lab_order_items" to "anon";

grant REFERENCES on public."lab_order_items" to "anon";

grant TRIGGER on public."lab_order_items" to "anon";

grant INSERT on public."lab_order_items" to "authenticated";

grant SELECT on public."lab_order_items" to "authenticated";

grant TRUNCATE on public."lab_order_items" to "authenticated";

grant REFERENCES on public."lab_order_items" to "authenticated";

grant TRIGGER on public."lab_order_items" to "authenticated";

grant TRUNCATE on public."attachments" to "anon";

grant REFERENCES on public."attachments" to "anon";

grant TRIGGER on public."attachments" to "anon";

grant INSERT on public."attachments" to "authenticated";

grant SELECT on public."attachments" to "authenticated";

grant TRUNCATE on public."attachments" to "authenticated";

grant REFERENCES on public."attachments" to "authenticated";

grant TRIGGER on public."attachments" to "authenticated";

grant TRUNCATE on public."audit_logs" to "anon";

grant REFERENCES on public."audit_logs" to "anon";

grant TRIGGER on public."audit_logs" to "anon";

grant SELECT on public."audit_logs" to "authenticated";

grant TRUNCATE on public."audit_logs" to "authenticated";

grant REFERENCES on public."audit_logs" to "authenticated";

grant TRIGGER on public."audit_logs" to "authenticated";

grant TRUNCATE on public."lab_workflow_events" to "anon";

grant REFERENCES on public."lab_workflow_events" to "anon";

grant TRIGGER on public."lab_workflow_events" to "anon";

grant SELECT on public."lab_workflow_events" to "authenticated";

grant TRUNCATE on public."lab_workflow_events" to "authenticated";

grant REFERENCES on public."lab_workflow_events" to "authenticated";

grant TRIGGER on public."lab_workflow_events" to "authenticated";

grant TRUNCATE on public."consents" to "anon";

grant REFERENCES on public."consents" to "anon";

grant TRIGGER on public."consents" to "anon";

grant INSERT on public."consents" to "authenticated";

grant SELECT on public."consents" to "authenticated";

grant UPDATE on public."consents" to "authenticated";

grant TRUNCATE on public."consents" to "authenticated";

grant REFERENCES on public."consents" to "authenticated";

grant TRIGGER on public."consents" to "authenticated";

grant TRUNCATE on public."admin_profiles" to "anon";

grant REFERENCES on public."admin_profiles" to "anon";

grant TRIGGER on public."admin_profiles" to "anon";

grant TRUNCATE on public."admin_profiles" to "authenticated";

grant REFERENCES on public."admin_profiles" to "authenticated";

grant TRIGGER on public."admin_profiles" to "authenticated";

grant TRUNCATE on public."follow_ups" to "anon";

grant REFERENCES on public."follow_ups" to "anon";

grant TRIGGER on public."follow_ups" to "anon";

grant INSERT on public."follow_ups" to "authenticated";

grant SELECT on public."follow_ups" to "authenticated";

grant UPDATE on public."follow_ups" to "authenticated";

grant TRUNCATE on public."follow_ups" to "authenticated";

grant REFERENCES on public."follow_ups" to "authenticated";

grant TRIGGER on public."follow_ups" to "authenticated";

grant TRUNCATE on public."voice_notes" to "anon";

grant REFERENCES on public."voice_notes" to "anon";

grant TRIGGER on public."voice_notes" to "anon";

grant INSERT on public."voice_notes" to "authenticated";

grant SELECT on public."voice_notes" to "authenticated";

grant UPDATE on public."voice_notes" to "authenticated";

grant TRUNCATE on public."voice_notes" to "authenticated";

grant REFERENCES on public."voice_notes" to "authenticated";

grant TRIGGER on public."voice_notes" to "authenticated";

grant TRUNCATE on public."visits" to "anon";

grant REFERENCES on public."visits" to "anon";

grant TRIGGER on public."visits" to "anon";

grant INSERT on public."visits" to "authenticated";

grant SELECT on public."visits" to "authenticated";

grant UPDATE on public."visits" to "authenticated";

grant TRUNCATE on public."visits" to "authenticated";

grant REFERENCES on public."visits" to "authenticated";

grant TRIGGER on public."visits" to "authenticated";

grant TRUNCATE on public."transcripts" to "anon";

grant REFERENCES on public."transcripts" to "anon";

grant TRIGGER on public."transcripts" to "anon";

grant INSERT on public."transcripts" to "authenticated";

grant SELECT on public."transcripts" to "authenticated";

grant UPDATE on public."transcripts" to "authenticated";

grant TRUNCATE on public."transcripts" to "authenticated";

grant REFERENCES on public."transcripts" to "authenticated";

grant TRIGGER on public."transcripts" to "authenticated";

grant TRUNCATE on public."visit_summaries" to "anon";

grant REFERENCES on public."visit_summaries" to "anon";

grant TRIGGER on public."visit_summaries" to "anon";

grant SELECT on public."visit_summaries" to "authenticated";

grant TRUNCATE on public."visit_summaries" to "authenticated";

grant REFERENCES on public."visit_summaries" to "authenticated";

grant TRIGGER on public."visit_summaries" to "authenticated";

create policy "guest_result_access_insert_lab" on "public"."guest_result_accesses" as PERMISSIVE for INSERT to "authenticated" with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = guest_result_accesses.diagnostic_report_id) AND (dr.laboratory_id = ( SELECT auth.uid() AS uid)) AND (dr.status = ANY (ARRAY['final'::report_status, 'amended'::report_status])))))));

create policy "guest_result_access_select_lab" on "public"."guest_result_accesses" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = guest_result_accesses.diagnostic_report_id) AND (dr.laboratory_id = ( SELECT auth.uid() AS uid))))));

create policy "guest_result_access_update_lab" on "public"."guest_result_accesses" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = guest_result_accesses.diagnostic_report_id) AND (dr.laboratory_id = ( SELECT auth.uid() AS uid)))))) with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = guest_result_accesses.diagnostic_report_id) AND (dr.laboratory_id = ( SELECT auth.uid() AS uid)))))));

create policy "pab_voice_notes_select_doctor" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'pab-voice-notes'::text) AND (EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.audio_path = objects.name) AND (vn.archived_at IS NULL))))));

create policy "profiles_insert_own" on "public"."profiles" as PERMISSIVE for INSERT to "authenticated" with check ((id = auth.uid()));

create policy "profiles_select_own" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using ((id = auth.uid()));

create policy "profiles_select_related_doctor" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.patient_id = auth.uid()) AND (pdr.doctor_id = profiles.id) AND (pdr.status = 'active'::relationship_status)))));

create policy "profiles_select_related_patient" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = profiles.id) AND (pdr.status = 'active'::relationship_status)))) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = auth.uid()) AND (dp.is_verified = true))))));

create policy "profiles_update_own" on "public"."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = auth.uid())) with check ((id = auth.uid()));

create policy "doctor_profiles_insert_own" on "public"."doctor_profiles" as PERMISSIVE for INSERT to "authenticated" with check ((id = auth.uid()));

create policy "doctor_profiles_select_all_authenticated" on "public"."doctor_profiles" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "doctor_profiles_update_own" on "public"."doctor_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = auth.uid())) with check ((id = auth.uid()));

create policy "patient_profiles_insert_own" on "public"."patient_profiles" as PERMISSIVE for INSERT to "authenticated" with check ((id = auth.uid()));

create policy "patient_profiles_select_by_doctor" on "public"."patient_profiles" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = patient_profiles.id) AND (pdr.status = 'active'::relationship_status)))) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = auth.uid()) AND (dp.is_verified = true))))));

create policy "patient_profiles_select_own" on "public"."patient_profiles" as PERMISSIVE for SELECT to "authenticated" using ((id = auth.uid()));

create policy "patient_profiles_update_own" on "public"."patient_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = auth.uid())) with check ((id = auth.uid()));

create policy "organizations_select_members" on "public"."organizations" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = organizations.id) AND (om.profile_id = auth.uid())))));

create policy "organization_members_select_own_org" on "public"."organization_members" as PERMISSIVE for SELECT to "authenticated" using (((profile_id = ( SELECT auth.uid() AS uid)) OR (organization_id IN ( SELECT private.my_organization_ids() AS my_organization_ids))));

create policy "lab_profiles_insert_own" on "public"."laboratory_profiles" as PERMISSIVE for INSERT to "authenticated" with check ((id = auth.uid()));

create policy "lab_profiles_select_all_authenticated" on "public"."laboratory_profiles" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "lab_profiles_update_own" on "public"."laboratory_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = auth.uid())) with check ((id = auth.uid()));

create policy "pdr_insert_doctor" on "public"."patient_doctor_relationships" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = auth.uid()) AND (status = 'pending'::relationship_status) AND (EXISTS ( SELECT 1
   FROM doctor_profiles d
  WHERE ((d.id = auth.uid()) AND (d.is_verified = true))))));

create policy "pdr_insert_patient" on "public"."patient_doctor_relationships" as PERMISSIVE for INSERT to "authenticated" with check (((patient_id = auth.uid()) AND (status = 'pending'::relationship_status)));

create policy "pdr_select_involved" on "public"."patient_doctor_relationships" as PERMISSIVE for SELECT to "authenticated" using (((patient_id = auth.uid()) OR (doctor_id = auth.uid())));

create policy "pdr_update_doctor" on "public"."patient_doctor_relationships" as PERMISSIVE for UPDATE to "authenticated" using ((doctor_id = auth.uid())) with check ((doctor_id = auth.uid()));

create policy "pdr_update_patient" on "public"."patient_doctor_relationships" as PERMISSIVE for UPDATE to "authenticated" using ((patient_id = auth.uid())) with check ((patient_id = auth.uid()));

create policy "test_definitions_select_authenticated" on "public"."test_definitions" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "test_aliases_select_authenticated" on "public"."test_aliases" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "test_panels_select_authenticated" on "public"."test_panels" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "test_panel_items_select_authenticated" on "public"."test_panel_items" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "reference_ranges_delete_own_lab" on "public"."reference_range_templates" as PERMISSIVE for DELETE to "authenticated" using ((laboratory_id = auth.uid()));

create policy "reference_ranges_insert_own_lab" on "public"."reference_range_templates" as PERMISSIVE for INSERT to "authenticated" with check ((laboratory_id = auth.uid()));

create policy "reference_ranges_select_authenticated" on "public"."reference_range_templates" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "reference_ranges_update_own_lab" on "public"."reference_range_templates" as PERMISSIVE for UPDATE to "authenticated" using ((laboratory_id = auth.uid())) with check ((laboratory_id = auth.uid()));

create policy "lab_orders_insert_doctor" on "public"."lab_orders" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = auth.uid()) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = lab_orders.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "lab_orders_select_doctor" on "public"."lab_orders" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = lab_orders.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "lab_orders_select_lab" on "public"."lab_orders" as PERMISSIVE for SELECT to "authenticated" using (((laboratory_id = ( SELECT auth.uid() AS uid)) OR ((laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(laboratory_branch_id, ( SELECT auth.uid() AS uid)))));

create policy "lab_orders_select_patient" on "public"."lab_orders" as PERMISSIVE for SELECT to "authenticated" using ((patient_id = auth.uid()));

create policy "lab_orders_update_doctor" on "public"."lab_orders" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = lab_orders.patient_id) AND (pdr.status = 'active'::relationship_status)))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = lab_orders.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "lab_orders_update_lab" on "public"."lab_orders" as PERMISSIVE for UPDATE to "authenticated" using (((laboratory_id = ( SELECT auth.uid() AS uid)) OR ((laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(laboratory_branch_id, ( SELECT auth.uid() AS uid))))) with check (((laboratory_id = ( SELECT auth.uid() AS uid)) OR ((laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(laboratory_branch_id, ( SELECT auth.uid() AS uid)))));

create policy "observations_insert_lab" on "public"."observations" as PERMISSIVE for INSERT to "authenticated" with check (((entered_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
  WHERE ((dr.id = observations.diagnostic_report_id) AND ((dr.laboratory_id = ( SELECT auth.uid() AS uid)) OR (lo.laboratory_id = ( SELECT auth.uid() AS uid)) OR ((lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid)))))))));

create policy "observations_select_doctor" on "public"."observations" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (((diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((dr.id = observations.diagnostic_report_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid))))));

create policy "observations_select_lab" on "public"."observations" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = observations.diagnostic_report_id) AND ((dr.laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM lab_orders lo
          WHERE ((lo.id = dr.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid))))))))));

create policy "observations_select_patient_current" on "public"."observations" as PERMISSIVE for SELECT to "authenticated" using (((status = ANY (ARRAY['final'::observation_status, 'corrected'::observation_status])) AND (EXISTS ( SELECT 1
   FROM (diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
  WHERE ((dr.id = observations.diagnostic_report_id) AND (dr.status = ANY (ARRAY['final'::report_status, 'amended'::report_status])) AND (lo.patient_id = ( SELECT auth.uid() AS uid)))))));

create policy "observations_update_lab" on "public"."observations" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = observations.diagnostic_report_id) AND ((dr.laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM lab_orders lo
          WHERE ((lo.id = dr.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid)))))))))) with check ((EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = observations.diagnostic_report_id) AND ((dr.laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM lab_orders lo
          WHERE ((lo.id = dr.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid))))))))));

create policy "interpretations_insert_doctor" on "public"."doctor_interpretations" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (((diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((dr.id = doctor_interpretations.diagnostic_report_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid)))))));

create policy "interpretations_select_doctor" on "public"."doctor_interpretations" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (((diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((dr.id = doctor_interpretations.diagnostic_report_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid)))))));

create policy "interpretations_select_patient" on "public"."doctor_interpretations" as PERMISSIVE for SELECT to "authenticated" using (((is_visible_to_patient = true) AND (EXISTS ( SELECT 1
   FROM (diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
  WHERE ((dr.id = doctor_interpretations.diagnostic_report_id) AND (lo.patient_id = auth.uid()))))));

create policy "interpretations_update_doctor" on "public"."doctor_interpretations" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (((diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((dr.id = doctor_interpretations.diagnostic_report_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid))))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (((diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((dr.id = doctor_interpretations.diagnostic_report_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid)))))));

create policy "diagnostic_reports_insert_lab" on "public"."diagnostic_reports" as PERMISSIVE for INSERT to "authenticated" with check ((laboratory_id = auth.uid()));

create policy "diagnostic_reports_select_doctor" on "public"."diagnostic_reports" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM ((lab_orders lo
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((lo.id = diagnostic_reports.lab_order_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid))))));

create policy "diagnostic_reports_select_lab" on "public"."diagnostic_reports" as PERMISSIVE for SELECT to "authenticated" using (((laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM lab_orders lo
  WHERE ((lo.id = diagnostic_reports.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid)))))));

create policy "diagnostic_reports_select_patient_final" on "public"."diagnostic_reports" as PERMISSIVE for SELECT to "authenticated" using (((status = ANY (ARRAY['final'::report_status, 'amended'::report_status])) AND (EXISTS ( SELECT 1
   FROM lab_orders lo
  WHERE ((lo.id = diagnostic_reports.lab_order_id) AND (lo.patient_id = ( SELECT auth.uid() AS uid)))))));

create policy "diagnostic_reports_update_lab" on "public"."diagnostic_reports" as PERMISSIVE for UPDATE to "authenticated" using (((laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM lab_orders lo
  WHERE ((lo.id = diagnostic_reports.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid))))))) with check (((laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM lab_orders lo
  WHERE ((lo.id = diagnostic_reports.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid)))))));

create policy "doctor_notes_insert_own" on "public"."doctor_notes" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.patient_id = doctor_notes.patient_id) AND (pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.status = 'active'::relationship_status)))) AND ((diagnostic_report_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
  WHERE ((dr.id = doctor_notes.diagnostic_report_id) AND (lo.patient_id = doctor_notes.patient_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid))))))));

create policy "doctor_notes_select_own" on "public"."doctor_notes" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = doctor_notes.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "doctor_notes_update_own" on "public"."doctor_notes" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = doctor_notes.patient_id) AND (pdr.status = 'active'::relationship_status)))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = doctor_notes.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "prescriptions_insert_doctor" on "public"."prescriptions" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = prescriptions.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "prescriptions_select_doctor" on "public"."prescriptions" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = prescriptions.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "prescriptions_select_patient" on "public"."prescriptions" as PERMISSIVE for SELECT to "authenticated" using ((patient_id = auth.uid()));

create policy "prescriptions_update_doctor" on "public"."prescriptions" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = prescriptions.patient_id) AND (pdr.status = 'active'::relationship_status)))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = prescriptions.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "lab_dispatches_select_participants" on "public"."lab_dispatches" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM physician_lab_requests r
  WHERE ((r.id = lab_dispatches.physician_lab_request_id) AND ((r.doctor_id = ( SELECT auth.uid() AS uid)) OR (r.patient_id = ( SELECT auth.uid() AS uid)))))) OR (EXISTS ( SELECT 1
   FROM laboratory_branch_members lbm
  WHERE ((lbm.branch_id = lab_dispatches.laboratory_branch_id) AND (lbm.profile_id = ( SELECT auth.uid() AS uid)) AND (lbm.is_active = true))))));

create policy "physician_lab_requests_select_participants" on "public"."physician_lab_requests" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) OR (patient_id = ( SELECT auth.uid() AS uid)) OR private.is_current_user_member_of_lab_request(id)));

create policy "notifications_select_own" on "public"."notifications" as PERMISSIVE for SELECT to "authenticated" using ((recipient_id = auth.uid()));

create policy "notifications_update_own" on "public"."notifications" as PERMISSIVE for UPDATE to "authenticated" using ((recipient_id = auth.uid())) with check ((recipient_id = auth.uid()));

create policy "prescription_items_insert_doctor" on "public"."prescription_items" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM ((prescriptions p
     JOIN doctor_profiles dp ON (((dp.id = p.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = p.doctor_id) AND (pdr.patient_id = p.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((p.id = prescription_items.prescription_id) AND (p.doctor_id = ( SELECT auth.uid() AS uid))))));

create policy "prescription_items_select" on "public"."prescription_items" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM prescriptions p
  WHERE ((p.id = prescription_items.prescription_id) AND ((p.patient_id = ( SELECT auth.uid() AS uid)) OR ((p.doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
           FROM doctor_profiles dp
          WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
           FROM patient_doctor_relationships pdr
          WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = p.patient_id) AND (pdr.status = 'active'::relationship_status))))))))));

create policy "ai_analyses_select_doctor" on "public"."ai_analyses" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = ai_analyses.patient_id) AND (pdr.status = 'active'::relationship_status)))) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = auth.uid()) AND (dp.is_verified = true))))));

create policy "ai_analyses_select_patient" on "public"."ai_analyses" as PERMISSIVE for SELECT to "authenticated" using (((patient_id = auth.uid()) AND (is_visible_to_patient = true) AND (review_status = ANY (ARRAY['approved'::ai_review_status, 'edited'::ai_review_status]))));

create policy "ai_analyses_update_doctor" on "public"."ai_analyses" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = ai_analyses.patient_id) AND (pdr.status = 'active'::relationship_status))))) with check ((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = ai_analyses.patient_id) AND (pdr.status = 'active'::relationship_status)))));

create policy "trend_select_doctor" on "public"."trend_analyses" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = auth.uid()) AND (pdr.patient_id = trend_analyses.patient_id) AND (pdr.status = 'active'::relationship_status)))) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = auth.uid()) AND (dp.is_verified = true))))));

create policy "trend_select_patient" on "public"."trend_analyses" as PERMISSIVE for SELECT to "authenticated" using ((patient_id = auth.uid()));

create policy "laboratory_branches_select_catalog" on "public"."laboratory_branches" as PERMISSIVE for SELECT to "authenticated" using (((is_active = true) OR (EXISTS ( SELECT 1
   FROM laboratory_branch_members lbm
  WHERE ((lbm.branch_id = laboratory_branches.id) AND (lbm.profile_id = ( SELECT auth.uid() AS uid)) AND (lbm.is_active = true))))));

create policy "laboratory_branch_members_select_own" on "public"."laboratory_branch_members" as PERMISSIVE for SELECT to "authenticated" using ((profile_id = ( SELECT auth.uid() AS uid)));

create policy "physician_lab_request_items_select_participants" on "public"."physician_lab_request_items" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM physician_lab_requests r
  WHERE ((r.id = physician_lab_request_items.physician_lab_request_id) AND ((r.doctor_id = ( SELECT auth.uid() AS uid)) OR (r.patient_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM (lab_dispatches ld
             JOIN laboratory_branch_members lbm ON ((lbm.branch_id = ld.laboratory_branch_id)))
          WHERE ((ld.physician_lab_request_id = r.id) AND (lbm.profile_id = ( SELECT auth.uid() AS uid)) AND (lbm.is_active = true)))))))));

create policy "home_collection_requests_select_participants" on "public"."home_collection_requests" as PERMISSIVE for SELECT to "authenticated" using (((patient_id = ( SELECT auth.uid() AS uid)) OR (doctor_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM laboratory_branch_members lbm
  WHERE ((lbm.branch_id = home_collection_requests.laboratory_branch_id) AND (lbm.profile_id = ( SELECT auth.uid() AS uid)) AND (lbm.is_active = true))))));

create policy "home_collection_private_details_select_destination_lab" on "public"."home_collection_private_details" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (home_collection_requests hcr
     JOIN laboratory_branch_members lbm ON ((lbm.branch_id = hcr.laboratory_branch_id)))
  WHERE ((hcr.id = home_collection_private_details.home_collection_request_id) AND (lbm.profile_id = ( SELECT auth.uid() AS uid)) AND (lbm.is_active = true) AND (hcr.status <> ALL (ARRAY['rejected'::text, 'cancelled'::text]))))));

create policy "lab_order_items_insert_doctor" on "public"."lab_order_items" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM ((lab_orders lo
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((lo.id = lab_order_items.lab_order_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid))))));

create policy "lab_order_items_select" on "public"."lab_order_items" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM lab_orders lo
  WHERE ((lo.id = lab_order_items.lab_order_id) AND ((lo.patient_id = ( SELECT auth.uid() AS uid)) OR ((lo.doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
           FROM doctor_profiles dp
          WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true))))) OR (lo.laboratory_id = ( SELECT auth.uid() AS uid)) OR ((lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid))))))));

create policy "attachments_insert_lab" on "public"."attachments" as PERMISSIVE for INSERT to "authenticated" with check (((uploaded_by = ( SELECT auth.uid() AS uid)) AND (diagnostic_report_id IS NOT NULL) AND (file_type = 'application/pdf'::text) AND ((file_size_bytes >= 1) AND (file_size_bytes <= 10485760)) AND (storage_path ~~ ((((uploaded_by)::text || '/'::text) || (diagnostic_report_id)::text) || '/%'::text)) AND (EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = attachments.diagnostic_report_id) AND ((dr.laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM lab_orders lo
          WHERE ((lo.id = dr.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_result_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid)))))))))));

create policy "attachments_select_doctor" on "public"."attachments" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (((diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
     JOIN doctor_profiles dp ON (((dp.id = lo.doctor_id) AND (dp.is_verified = true))))
     JOIN patient_doctor_relationships pdr ON (((pdr.doctor_id = lo.doctor_id) AND (pdr.patient_id = lo.patient_id) AND (pdr.status = 'active'::relationship_status))))
  WHERE ((dr.id = attachments.diagnostic_report_id) AND (lo.doctor_id = ( SELECT auth.uid() AS uid))))));

create policy "attachments_select_lab" on "public"."attachments" as PERMISSIVE for SELECT to "authenticated" using (((file_type = 'application/pdf'::text) AND ((file_size_bytes >= 1) AND (file_size_bytes <= 10485760)) AND (storage_path ~~ ((((uploaded_by)::text || '/'::text) || (diagnostic_report_id)::text) || '/%'::text)) AND (EXISTS ( SELECT 1
   FROM diagnostic_reports dr
  WHERE ((dr.id = attachments.diagnostic_report_id) AND ((dr.laboratory_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM lab_orders lo
          WHERE ((lo.id = dr.lab_order_id) AND (lo.laboratory_branch_id IS NOT NULL) AND is_laboratory_branch_result_member(lo.laboratory_branch_id, ( SELECT auth.uid() AS uid)))))))))));

create policy "attachments_select_patient_final" on "public"."attachments" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (diagnostic_reports dr
     JOIN lab_orders lo ON ((lo.id = dr.lab_order_id)))
  WHERE ((dr.id = attachments.diagnostic_report_id) AND (dr.status = ANY (ARRAY['final'::report_status, 'amended'::report_status])) AND (lo.patient_id = ( SELECT auth.uid() AS uid))))));

create policy "audit_logs_select_own" on "public"."audit_logs" as PERMISSIVE for SELECT to "authenticated" using ((actor_id = auth.uid()));

create policy "lab_workflow_events_select_participants" on "public"."lab_workflow_events" as PERMISSIVE for SELECT to "authenticated" using (((actor_id = ( SELECT auth.uid() AS uid)) OR (doctor_id = ( SELECT auth.uid() AS uid)) OR (patient_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM laboratory_branch_members lbm
  WHERE ((lbm.branch_id = lab_workflow_events.laboratory_branch_id) AND (lbm.profile_id = ( SELECT auth.uid() AS uid)) AND (lbm.is_active = true))))));

create policy "consents_insert_own" on "public"."consents" as PERMISSIVE for INSERT to "authenticated" with check ((patient_id = auth.uid()));

create policy "consents_select_active_voice_recording_to_doctor" on "public"."consents" as PERMISSIVE for SELECT to "authenticated" using (((consent_type = 'physician_voice_recording'::text) AND (granted = true) AND (revoked_at IS NULL) AND (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN doctor_profiles dp ON ((dp.id = p.id)))
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'doctor'::user_role) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.patient_id = consents.patient_id) AND (pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.status = 'active'::relationship_status))))));

create policy "consents_select_own" on "public"."consents" as PERMISSIVE for SELECT to "authenticated" using ((patient_id = auth.uid()));

create policy "consents_update_own" on "public"."consents" as PERMISSIVE for UPDATE to "authenticated" using ((patient_id = auth.uid())) with check ((patient_id = auth.uid()));

create policy "follow_ups_insert_doctor" on "public"."follow_ups" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = follow_ups.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "follow_ups_select_doctor" on "public"."follow_ups" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = follow_ups.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "follow_ups_select_patient" on "public"."follow_ups" as PERMISSIVE for SELECT to "authenticated" using ((patient_id = ( SELECT auth.uid() AS uid)));

create policy "follow_ups_update_doctor" on "public"."follow_ups" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = follow_ups.patient_id) AND (pdr.status = 'active'::relationship_status)))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = follow_ups.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "voice_notes_insert_doctor" on "public"."voice_notes" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true))))));

create policy "voice_notes_select_doctor" on "public"."voice_notes" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (archived_at IS NULL) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = voice_notes.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "voice_notes_update_doctor" on "public"."voice_notes" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = voice_notes.patient_id) AND (pdr.status = 'active'::relationship_status)))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = voice_notes.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "visits_insert_doctor" on "public"."visits" as PERMISSIVE for INSERT to "authenticated" with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = visits.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "visits_select_doctor" on "public"."visits" as PERMISSIVE for SELECT to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = visits.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "visits_select_patient" on "public"."visits" as PERMISSIVE for SELECT to "authenticated" using ((patient_id = ( SELECT auth.uid() AS uid)));

create policy "visits_update_doctor" on "public"."visits" as PERMISSIVE for UPDATE to "authenticated" using (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = visits.patient_id) AND (pdr.status = 'active'::relationship_status)))))) with check (((doctor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.id = ( SELECT auth.uid() AS uid)) AND (dp.is_verified = true)))) AND (EXISTS ( SELECT 1
   FROM patient_doctor_relationships pdr
  WHERE ((pdr.doctor_id = ( SELECT auth.uid() AS uid)) AND (pdr.patient_id = visits.patient_id) AND (pdr.status = 'active'::relationship_status))))));

create policy "transcripts_insert_doctor" on "public"."transcripts" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = transcripts.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL)))));

create policy "transcripts_select_doctor" on "public"."transcripts" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = transcripts.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL)))));

create policy "transcripts_update_doctor" on "public"."transcripts" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = transcripts.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = transcripts.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL)))));

create policy "visit_summaries_insert_doctor" on "public"."visit_summaries" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = visit_summaries.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL)))));

create policy "visit_summaries_select_doctor" on "public"."visit_summaries" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = visit_summaries.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL)))));

create policy "visit_summaries_update_doctor" on "public"."visit_summaries" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = visit_summaries.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((voice_notes vn
     JOIN patient_doctor_relationships pdr ON (((pdr.patient_id = vn.patient_id) AND (pdr.doctor_id = vn.doctor_id) AND (pdr.status = 'active'::relationship_status))))
     JOIN doctor_profiles dp ON (((dp.id = vn.doctor_id) AND (dp.is_verified = true))))
  WHERE ((vn.id = visit_summaries.voice_note_id) AND (vn.doctor_id = ( SELECT auth.uid() AS uid)) AND (vn.archived_at IS NULL)))));

CREATE TRIGGER trg_audit_guest_result_access_event AFTER INSERT OR UPDATE OF revoked_at ON public.guest_result_accesses FOR EACH ROW EXECUTE FUNCTION audit_guest_result_access_event();

CREATE TRIGGER trg_guard_guest_result_access BEFORE INSERT OR UPDATE ON public.guest_result_accesses FOR EACH ROW EXECUTE FUNCTION guard_guest_result_access();

CREATE TRIGGER trg_audit_profiles_update AFTER UPDATE OF full_name, avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.audit_profiles_update();

CREATE TRIGGER trg_guard_admin_role_change BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_admin_role_change();

CREATE TRIGGER trg_guard_profile_role BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_role();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_guard_doctor_profile BEFORE INSERT OR UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION guard_doctor_profile();

CREATE TRIGGER trg_audit_patient_profiles_update AFTER INSERT OR UPDATE OF date_of_birth, sex, blood_type, emergency_contact_name, emergency_contact_phone ON public.patient_profiles FOR EACH ROW EXECUTE FUNCTION private.audit_patient_profiles_update();

CREATE TRIGGER trg_guard_laboratory_profile BEFORE INSERT OR UPDATE ON public.laboratory_profiles FOR EACH ROW EXECUTE FUNCTION guard_laboratory_profile();

CREATE TRIGGER trg_guard_pdr BEFORE INSERT OR UPDATE ON public.patient_doctor_relationships FOR EACH ROW EXECUTE FUNCTION guard_pdr();

CREATE TRIGGER aaa_guard_laboratory_branch_order_role BEFORE UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION guard_laboratory_branch_order_role();

CREATE TRIGGER trg_audit_lab_order_event AFTER UPDATE OF status ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION audit_lab_order_event();

CREATE TRIGGER trg_guard_lab_order BEFORE INSERT OR UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION guard_lab_order();

CREATE TRIGGER trg_lab_workflow_events_order AFTER INSERT OR UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION log_lab_workflow_mutation();

CREATE TRIGGER trg_notify_completed_lab_order AFTER UPDATE OF status ON public.lab_orders FOR EACH ROW WHEN (((new.status = 'completed'::order_status) AND (old.status IS DISTINCT FROM new.status))) EXECUTE FUNCTION notify_completed_lab_order();

CREATE TRIGGER trg_sync_lab_request_from_completed_order AFTER UPDATE OF status ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION sync_lab_request_from_completed_order();

CREATE TRIGGER aaa_guard_laboratory_branch_observation_role BEFORE INSERT OR UPDATE ON public.observations FOR EACH ROW EXECUTE FUNCTION guard_laboratory_branch_result_role();

CREATE TRIGGER trg_audit_observation_event AFTER INSERT OR UPDATE OF status ON public.observations FOR EACH ROW EXECUTE FUNCTION audit_observation_event();

CREATE TRIGGER trg_guard_observation BEFORE INSERT OR UPDATE ON public.observations FOR EACH ROW EXECUTE FUNCTION guard_observation();

CREATE TRIGGER trg_doctor_interpretations_updated_at BEFORE UPDATE ON public.doctor_interpretations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_guard_doctor_interpretation BEFORE INSERT OR UPDATE ON public.doctor_interpretations FOR EACH ROW EXECUTE FUNCTION guard_doctor_interpretation();

CREATE TRIGGER aaa_guard_laboratory_branch_report_role BEFORE INSERT OR UPDATE ON public.diagnostic_reports FOR EACH ROW EXECUTE FUNCTION guard_laboratory_branch_result_role();

CREATE TRIGGER trg_audit_diagnostic_report_event AFTER UPDATE OF status ON public.diagnostic_reports FOR EACH ROW EXECUTE FUNCTION audit_diagnostic_report_event();

CREATE TRIGGER trg_diagnostic_reports_updated_at BEFORE UPDATE ON public.diagnostic_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_guard_diagnostic_report BEFORE INSERT OR UPDATE ON public.diagnostic_reports FOR EACH ROW EXECUTE FUNCTION guard_diagnostic_report();

CREATE TRIGGER trg_notify_new_lab_result AFTER UPDATE OF status ON public.diagnostic_reports FOR EACH ROW WHEN (((new.status = ANY (ARRAY['final'::report_status, 'amended'::report_status])) AND (old.status IS DISTINCT FROM new.status))) EXECUTE FUNCTION notify_new_lab_result();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.doctor_notes FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_guard_doctor_note BEFORE INSERT OR UPDATE ON public.doctor_notes FOR EACH ROW EXECUTE FUNCTION guard_doctor_note();

CREATE TRIGGER trg_guard_prescription BEFORE INSERT OR UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION guard_prescription();

CREATE TRIGGER trg_guard_lab_dispatch BEFORE INSERT OR UPDATE ON public.lab_dispatches FOR EACH ROW EXECUTE FUNCTION guard_lab_dispatch();

CREATE TRIGGER trg_lab_workflow_events_dispatch AFTER INSERT OR UPDATE ON public.lab_dispatches FOR EACH ROW EXECUTE FUNCTION log_lab_workflow_mutation();

CREATE TRIGGER trg_notify_lab_dispatch_transition AFTER INSERT OR UPDATE OF status ON public.lab_dispatches FOR EACH ROW EXECUTE FUNCTION notify_lab_dispatch_transition();

CREATE TRIGGER trg_guard_lab_request BEFORE INSERT OR UPDATE ON public.physician_lab_requests FOR EACH ROW EXECUTE FUNCTION guard_lab_request();

CREATE TRIGGER trg_lab_workflow_events_request AFTER INSERT OR UPDATE ON public.physician_lab_requests FOR EACH ROW EXECUTE FUNCTION log_lab_workflow_mutation();

CREATE TRIGGER trg_notify_physician_lab_request_created AFTER INSERT ON public.physician_lab_requests FOR EACH ROW EXECUTE FUNCTION notify_physician_lab_request_created();

CREATE TRIGGER trg_audit_patient_notification_read AFTER UPDATE OF is_read ON public.notifications FOR EACH ROW EXECUTE FUNCTION audit_patient_notification_read();

CREATE TRIGGER trg_guard_notification BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION guard_notification();

CREATE TRIGGER trg_sync_notification_status BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION sync_notification_status();

CREATE TRIGGER trg_guard_ai_analysis BEFORE UPDATE ON public.ai_analyses FOR EACH ROW EXECUTE FUNCTION guard_ai_analysis();

CREATE TRIGGER trg_guard_home_collection_request BEFORE INSERT OR UPDATE ON public.home_collection_requests FOR EACH ROW EXECUTE FUNCTION guard_home_collection_request();

CREATE TRIGGER trg_lab_workflow_events_home_collection AFTER INSERT OR UPDATE ON public.home_collection_requests FOR EACH ROW EXECUTE FUNCTION log_lab_workflow_mutation();

CREATE TRIGGER trg_notify_home_collection_transition AFTER UPDATE OF status ON public.home_collection_requests FOR EACH ROW EXECUTE FUNCTION notify_home_collection_transition();

CREATE TRIGGER trg_lab_workflow_events_private_details AFTER INSERT OR UPDATE ON public.home_collection_private_details FOR EACH ROW EXECUTE FUNCTION log_lab_workflow_mutation();

CREATE TRIGGER aaa_guard_report_attachment_metadata BEFORE INSERT ON public.attachments FOR EACH ROW EXECUTE FUNCTION guard_report_attachment_metadata();

CREATE TRIGGER trg_audit_lab_workflow_qr_token AFTER INSERT OR UPDATE OF revoked_at ON public.lab_workflow_qr_tokens FOR EACH ROW EXECUTE FUNCTION audit_lab_workflow_qr_token();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.consents FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_guard_consent BEFORE INSERT OR UPDATE ON public.consents FOR EACH ROW EXECUTE FUNCTION guard_consent();

CREATE TRIGGER trg_guard_admin_profile BEFORE INSERT OR UPDATE ON public.admin_profiles FOR EACH ROW EXECUTE FUNCTION guard_admin_profile();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_guard_follow_up BEFORE INSERT OR UPDATE ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION guard_follow_up();

CREATE TRIGGER trg_notify_follow_up_created AFTER INSERT ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION notify_follow_up_created();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.voice_notes FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_guard_voice_note BEFORE INSERT OR UPDATE ON public.voice_notes FOR EACH ROW EXECUTE FUNCTION guard_voice_note();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_guard_visit BEFORE INSERT OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION guard_visit();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.transcripts FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_audit_physician_care_event AFTER INSERT OR UPDATE ON public.visit_summaries FOR EACH ROW EXECUTE FUNCTION audit_physician_care_event();

CREATE TRIGGER trg_guard_visit_summary BEFORE INSERT OR UPDATE ON public.visit_summaries FOR EACH ROW EXECUTE FUNCTION guard_visit_summary();

-- Supabase Storage bucket metadata used by the care-platform tests.
create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
alter table auth.users add column if not exists phone text,add column if not exists phone_confirmed_at timestamptz;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
