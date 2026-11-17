create or replace function private.pas_get_patient_final_results(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
  v_result jsonb;
begin
  if v_actor is null
     or not exists(select 1 from public.profiles where id=v_actor and role='patient')
     or not exists(select 1 from public.patient_profiles where id=v_actor) then
    raise exception 'Patient authentication required' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by performed_at desc),'[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'result_id',r.id,'result_kind',r.result_kind,'version_number',r.version_number,
      'performed_at',r.performed_at,'finalized_at',r.finalized_at,
      'provider',jsonb_build_object('display_name',pr.display_name,'provider_kind',pr.provider_kind),
      'laboratory_values',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'test_name',td.name,'test_name_fa',td.name_fa,
          'value_numeric',lv.value_numeric,'value_text',lv.value_text,'value_boolean',lv.value_boolean,
          'unit',lv.unit,'reference_min',lv.reference_min,'reference_max',lv.reference_max,
          'reference_text',lv.reference_text,'abnormal_flag',lv.abnormal_flag,'observed_at',lv.observed_at
        ) order by lv.observed_at),'[]'::jsonb)
        from public.pas_referral_lab_values lv
        join public.test_definitions td on td.id=lv.test_definition_id
        where lv.result_id=r.id
      ),
      'imaging_report',(
        select jsonb_build_object(
          'report_text',ir.report_text,'findings',ir.findings,'impression',ir.impression,
          'pacs_study_uid',ir.pacs_study_uid,'images_available',ir.image_storage_path is not null
        )
        from public.pas_referral_imaging_reports ir where ir.result_id=r.id
      ),
      'pharmacy_dispenses',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'item',pi.external_display,'dispense_status',pd.dispense_status,
          'prescribed_quantity',pd.prescribed_quantity,'dispensed_quantity',pd.dispensed_quantity,
          'substitute_display',pd.substitute_display,'not_dispensed_reason',pd.not_dispensed_reason,
          'dispensed_at',pd.dispensed_at
        )),'[]'::jsonb)
        from public.pas_referral_pharmacy_dispenses pd
        join public.pas_execution_referral_items ri on ri.id=pd.referral_item_id
        join public.pas_insurance_prescription_items pi on pi.id=ri.prescription_item_id
        where pd.result_id=r.id
      ),
      'service_results',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'service_group',sr.service_group,'data',sr.structured_data
        )),'[]'::jsonb)
        from public.pas_referral_service_results sr where sr.result_id=r.id
      )
    ) as item,
    coalesce(r.performed_at,r.finalized_at,r.received_at) as performed_at,
    r.id as result_id
    from public.pas_referral_results r
    join public.pas_execution_referrals er on er.id=r.referral_id
    join public.pas_insurance_prescriptions rx on rx.id=er.prescription_id
    join public.pas_provider_registry pr on pr.id=r.provider_id
    where rx.patient_id=v_actor
      and rx.identity_match_status='matched'
      and r.status in ('final','amended')
      and r.published_at is not null
      and not exists(
        select 1 from public.pas_referral_results later
        where later.result_chain_id=r.result_chain_id
          and later.version_number>r.version_number
          and later.status in ('final','amended','retracted')
      )
    order by coalesce(r.performed_at,r.finalized_at,r.received_at) desc,r.id desc
    limit v_limit
  ) q;

  insert into public.pas_referral_events(
    prescription_id,referral_id,result_id,event_type,actor_profile_id,actor_kind,metadata
  )
  select er.prescription_id,er.id,r.id,'patient.result.listed',v_actor,'patient',
    jsonb_build_object('channel','patient_results_rpc')
  from public.pas_referral_results r
  join public.pas_execution_referrals er on er.id=r.referral_id
  join public.pas_insurance_prescriptions rx on rx.id=er.prescription_id
  where rx.patient_id=v_actor
    and rx.identity_match_status='matched'
    and r.status in ('final','amended')
    and r.published_at is not null
    and not exists(
      select 1 from public.pas_referral_results later
      where later.result_chain_id=r.result_chain_id
        and later.version_number>r.version_number
        and later.status in ('final','amended','retracted')
    )
  order by coalesce(r.performed_at,r.finalized_at,r.received_at) desc,r.id desc
  limit v_limit;

  return jsonb_build_object('items',v_result,'limit',v_limit);
end
$function$;

revoke all on function private.pas_get_patient_final_results(integer) from public,anon;
grant execute on function private.pas_get_patient_final_results(integer) to authenticated,service_role;
