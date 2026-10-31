import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.PAS_SECURITY_IMPORT_ONLY='1';
const {db,a,f,id,insert,fixtures,snapshot,test,results}=await import('./database.mjs');
const root=path.resolve(import.meta.dirname,'../..');
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const cmd=(name,payload)=>`select public.pas_care_command(${q(name)},${q(JSON.stringify(payload))}::jsonb) as data`;
const claims=name=>`select set_config('request.jwt.claims',${q(JSON.stringify({sub:a[name],role:'authenticated'}))},true)`;
const ok=r=>Boolean(r.rows[0]?.data?.id);
const kinds={radiology:'xray',mri:'mri',ct:'ct',ultrasound:'ultrasound',mammography:'mammography',ecg:'ecg',physiotherapy:'physiotherapy',other:'other'};
try {
 await db.exec(fs.readFileSync(root+'/tests/security/fixtures/schema.sql','utf8'));
 await db.exec('set check_function_bodies=on;');
 for(const file of fs.readdirSync(root+'/supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(root+'/supabase/migrations/'+file,'utf8'));
 await fixtures();
 for(const [i,[type,service]] of Object.entries(kinds).entries()){
  a[type]=id(200+i);
  await insert('auth.users',{id:a[type]});
  await insert('public.profiles',{id:a[type],role:'patient',full_name:'AUDIT '+type});
  await db.query('select public.pas_provision_center($1,$2,$3,$4,$5)',[a[type],a.admin,type,'AUDIT '+type,'AUDIT_'+type.toUpperCase()]);
  await insert('public.pas_medical_requests',{id:id(300+i),patient_id:a.p1,doctor_id:a.d1,provider_id:a[type],service_kind:service,service_name:'AUDIT '+type,status:'accepted',service_details:type==='physiotherapy'?{requested_sessions:2}:{}});
 }
 await insert('public.pas_provider_services',{provider_id:a.lab1,service_kind:'mri'}); // Untrusted legacy declaration must grant nothing.
 await insert('public.pas_medical_requests',{id:id(330),patient_id:a.p1,doctor_id:a.d1,provider_id:a.lab1,service_kind:'mri',service_name:'AUDIT old misrouted MRI',status:'accepted'});
 await insert('public.lab_orders',{id:id(340),patient_id:a.p1,doctor_id:a.d1,laboratory_id:a.mri,status:'in_progress',received_at:new Date().toISOString()});
 await insert('public.diagnostic_reports',{id:id(341),lab_order_id:id(340),laboratory_id:a.mri,entered_by:a.mri,status:'draft'});
 const before=await snapshot();
 for(const [i,[type,service]] of Object.entries(kinds).entries()){
  await test('center_'+type+'_own_identity',type,`select count(*)::int n from public.pas_medical_centers where profile_id=${q(a[type])} and center_type=${q(type)}`,'one');
  await test('center_'+type+'_own_worklist',type,`select jsonb_array_length(public.pas_center_worklist()->'items')::int n`,'one');
  await test('center_'+type+'_other_center_hidden',type,`select count(*)::int n from public.pas_medical_requests where id=${q(id(300+(i+1)%8))}`,'zero');
  await test('center_'+type+'_cannot_retype',type,`update public.pas_medical_centers set center_type='physiotherapy' where profile_id=${q(a[type])} returning profile_id`,'denied');
  await test('center_'+type+'_cannot_self_enable_service',type,cmd('provider.services',{services:['ct','mri']}),'denied');
  await test('doctor_can_assign_'+type,'d1',cmd('medical.request',{patient_id:a.p1,provider_id:a[type],service_kind:service,service_name:'AUDIT typed referral'}),ok);
 }
 await test('lab_legacy_claim_does_not_enter_directory','p1',`select count(*)::int n from jsonb_array_elements(public.pas_service_providers()) d where d->>'provider_id'=${q(a.lab1)}`,'zero');
 await test('lab_cannot_process_misrouted_mri','lab1',cmd('medical.advance',{id:id(330),status:'in_progress'}),'denied');
 await test('lab_misrouted_mri_hidden','lab1',`select count(*)::int n from public.pas_medical_requests where id=${q(id(330))}`,'zero');
 await test('mri_legacy_lab_order_hidden','mri',`select count(*)::int n from public.lab_orders where id=${q(id(340))}`,'zero');
 await test('mri_legacy_lab_report_hidden','mri',`select count(*)::int n from public.diagnostic_reports where id=${q(id(341))}`,'zero');
 await test('mri_legacy_lab_rpc_blocked','mri',`select public.save_lab_results_atomic(${q(id(340))},${q(id(341))},${q(JSON.stringify([{test_definition_id:f.test,has_value:true,value_numeric:15}]))}::jsonb,false)`,{errors:['P0001'],messageIncludes:'access denied'});
 await test('mri_cannot_take_lab_membership','admin',`select public.admin_set_laboratory_branch_member(${q(f.b1)},${q(a.mri)},'member',true)`,'denied');
 await test('center_type_immutable_even_for_admin','admin',cmd('center.status',{id:a.mri,is_active:false,center_type:'physiotherapy'}),r=>Boolean(r.rows[0]?.data?.id),`select center_type='mri' as ok from public.pas_medical_centers where profile_id=${q(a.mri)}`);
 await test('center_cannot_activate_itself','mri',cmd('center.status',{id:a.mri,is_active:true}),'denied');
 await test('deactivated_center_worklist_denied','admin',[cmd('center.status',{id:a.mri,is_active:false}),claims('mri'),`select jsonb_array_length(public.pas_center_worklist()->'items')::int n`],'zero');
 await test('deactivated_center_processing_denied','admin',[cmd('center.status',{id:a.mri,is_active:false}),claims('mri'),cmd('medical.advance',{id:id(301),status:'in_progress'})],'denied');
 await test('nonadmin_cannot_call_provisioning','d1',`select public.pas_provision_center(${q(a.p2)},${q(a.admin)},'mri','AUDIT forged','AUDIT_FORGED')`,'denied');
 await test('private_old_dispatcher_is_not_callable','mri',`select private.pas_care_command_v1('provider.services','{"services":["ct"]}')`,'denied');
 await test('doctor_cannot_assign_wrong_modality','d1',cmd('medical.request',{patient_id:a.p1,provider_id:a.mri,service_kind:'xray',service_name:'AUDIT wrong modality'}),'denied');
 await test('malformed_service_details_rejected','d1',cmd('medical.request',{patient_id:a.p1,provider_id:a.mri,service_kind:'mri',service_name:'AUDIT malformed',service_details:{body_region:{bad:true}}}),{errors:['23514']});
 const final={id:id(301),conclusion:'AUDIT MRI conclusion',measurements:{protocol:'AUDIT protocol',findings:'AUDIT findings',impression:'AUDIT impression'}};
 await test('mri_structured_report_finalizes','mri',cmd('medical.finish',final),ok);
 await test('mri_wrong_modality_report_fields_rejected','mri',cmd('medical.finish',{...final,measurements:{views:'AUDIT views',findings:'AUDIT findings',impression:'AUDIT impression'}}),{errors:['23514']});
 await test('mri_report_requires_clinical_sections','mri',cmd('medical.finish',{...final,measurements:{protocol:'AUDIT only protocol'}}),{errors:['23514']});
 await test('other_center_cannot_write_mri_report','radiology',cmd('medical.finish',final),'denied');
 await test('mri_report_amendment_preserves_original','mri',[cmd('medical.finish',final),`select public.pas_care_command('medical.finish',jsonb_build_object('id',${q(id(301))},'conclusion','AUDIT amended','measurements','{"findings":"AUDIT amendment","impression":"AUDIT amended impression"}'::jsonb,'supersedes_id',(select id from public.pas_medical_results where request_id=${q(id(301))})))`,`select count(*)::int n from public.pas_medical_results where request_id=${q(id(301))}`],r=>r.rows[0]?.n===2);
 await test('patient_reads_own_center_report','mri',[cmd('medical.finish',final),claims('p1'),`select count(*)::int n from public.pas_medical_results where request_id=${q(id(301))}`],'one');
 await test('doctor_permission_revocation_hides_center_report','mri',[cmd('medical.finish',final),claims('p1'),cmd('access.set',{doctor_id:a.d1,scopes:['visits']}),claims('d1'),`select count(*)::int n from public.pas_medical_results where request_id=${q(id(301))}`],'zero');
 const session={id:id(306),session_id:id(360),session_number:1,occurred_at:new Date().toISOString(),interventions:'AUDIT therapy intervention',progress_note:'AUDIT observed progress'};
 await test('physiotherapy_session_recorded','physiotherapy',cmd('medical.session',session),ok);
 await test('physiotherapy_session_retry_is_idempotent','physiotherapy',[cmd('medical.session',session),cmd('medical.session',session),`select count(*)::int n from public.pas_therapy_sessions where request_id=${q(id(306))}`],'one');
 await test('physiotherapy_session_number_must_be_sequential','physiotherapy',cmd('medical.session',{...session,session_number:2}),{errors:['23514']});
 await test('mri_cannot_record_therapy','mri',cmd('medical.session',session),'denied');
 await test('patient_cannot_forge_therapy_session','p1',cmd('medical.session',session),'denied');
 await test('patient_reads_own_therapy_progress','physiotherapy',[cmd('medical.session',session),claims('p1'),`select count(*)::int n from public.pas_therapy_sessions where request_id=${q(id(306))}`],'one');
 await test('unrelated_patient_therapy_hidden','physiotherapy',[cmd('medical.session',session),claims('p2'),`select count(*)::int n from public.pas_therapy_sessions where request_id=${q(id(306))}`],'zero');
 await test('center_can_confirm_appointment','mri',cmd('medical.schedule',{id:id(301),scheduled_at:new Date(Date.now()+86400000).toISOString()}),ok);
 await test('other_center_cannot_change_appointment','radiology',cmd('medical.schedule',{id:id(301),scheduled_at:new Date(Date.now()+86400000).toISOString()}),'denied');
 for(const [i,type] of Object.keys(kinds).entries()){
  const measures=type==='physiotherapy'?{assessment:'AUDIT assessment',outcome:'AUDIT course outcome'}:type==='other'?{procedure:'AUDIT procedure',impression:'AUDIT interpretation'}:{findings:'AUDIT findings',impression:'AUDIT interpretation'};
  await test('center_'+type+'_typed_report_is_operational',type,cmd('medical.finish',{id:id(300+i),conclusion:'AUDIT final report',measurements:measures}),ok);
 }
 await test('doctor_scope_revocation_hides_therapy','physiotherapy',[cmd('medical.session',session),claims('p1'),cmd('access.set',{doctor_id:a.d1,scopes:['visits']}),claims('d1'),`select count(*)::int n from public.pas_therapy_sessions where request_id=${q(id(306))}`],'zero');
 await test('center_storage_stage_own_modality_allowed','mri',`insert into storage.objects(bucket_id,name,metadata) values('pas-medical-documents',${q(id(301)+'/'+a.mri+'/'+id(380)+'.pdf')},'{"size":128,"mimetype":"application/pdf"}') returning id`,'mutation');
 await test('other_center_storage_stage_denied','radiology',`insert into storage.objects(bucket_id,name,metadata) values('pas-medical-documents',${q(id(301)+'/'+a.radiology+'/'+id(380)+'.pdf')},'{"size":128,"mimetype":"application/pdf"}') returning id`,'denied');
 await test('worklist_pagination_keeps_older_requests_available','d1',[
  ...Array.from({length:26},(_,i)=>cmd('medical.request',{patient_id:a.p1,provider_id:a.mri,service_kind:'mri',service_name:'AUDIT pagination '+i})),claims('mri'),`select public.pas_center_worklist(p_page:=2) as data`
 ],r=>r.rows[0]?.data?.total===27&&r.rows[0]?.data?.items?.length===7&&r.rows[0]?.data?.counts?.requested===26);
 await test('worklist_search_filters_at_database','mri',`select public.pas_center_worklist(p_query:='not present in any service') as data`,r=>r.rows[0]?.data?.total===0&&r.rows[0]?.data?.items?.length===0);
 const after=await snapshot();assert.equal(before,after);
 const report={total:results.length,passed:results.filter(r=>r.passed).length,rollback_verified:before===after,tests:results};
 fs.writeFileSync(root+'/.security-results/centers.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.passed),rollback_verified:report.rollback_verified}));
 if(report.total!==report.passed)process.exitCode=1;
}catch(error){console.error(JSON.stringify({fatal:true,code:error.code,message:error.message,query:error.query?.slice(0,300),where:error.where}));process.exitCode=1;}
finally{await db.close();}
