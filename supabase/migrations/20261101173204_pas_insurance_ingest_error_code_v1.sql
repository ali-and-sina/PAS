alter table public.pas_insurance_ingest_events
  add column if not exists error_code text
  check (error_code is null or length(error_code) between 1 and 120);
