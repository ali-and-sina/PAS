import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output=path.join(root,'.security-results');
fs.mkdirSync(output,{recursive:true});
const db=new PGlite();
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const a={p1:id(1),p2:id(2),d1:id(3),d2:id(4),unverified:id(5),lab1:id(6),lab2:id(7),collector:id(8),admin:id(9)};
const f={org:id(10),b1:id(11),b2:id(12),rel1:id(20),rel2:id(21),pending:id(22),test:id(30),otherTest:id(31),o1:id(40),o2:id(41),o3:id(42),r1:id(50),r2:id(51),r3:id(52),obs1:id(60),obs2:id(61),obs3:id(62),note:id(70),rx:id(71),rxItem:id(72),ai:id(73),consent:id(74),visit:id(75),voice:id(76),summary:id(77),notification:id(78),attachment:id(79),guest:id(80)};
const lit=x=>x===null?'null':typeof x==='boolean'?String(x):typeof x==='number'?String(x):"'"+String(x).replaceAll("'","''")+"'";
const qi=x=>'"'+x.replaceAll('"','""')+'"';
const results=[];
const traces=[];

async function insert(table,row){
 const keys=Object.keys(row);return db.query(`insert into ${table} (${keys.map(qi).join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,keys.map(k=>typeof row[k]==='object'&&row[k]!==null?JSON.stringify(row[k]):row[k]));
}
async function fixtures(){
 await db.exec('begin;');
 for(const [name,uid] of Object.entries(a)){
  await insert('auth.users',{id:uid});
  const role=name.startsWith('p')?'patient':name.startsWith('d')||name==='unverified'?'doctor':name==='admin'?'admin':'laboratory';
  await insert('public.profiles',{id:uid,role,full_name:'AUDIT_'+name});
 }
 for(const p of [a.p1,a.p2])await insert('public.patient_profiles',{id:p,date_of_birth:'1990-01-01',sex:'male'});
 for(const d of [a.d1,a.d2,a.unverified])await insert('public.doctor_profiles',{id:d,medical_license_number:'AUDIT_'+d.slice(-4),is_verified:d!==a.unverified,verified_by:d===a.unverified?null:a.admin});
 await insert('public.admin_profiles',{id:a.admin,personnel_code:'AUDIT_ADMIN'});
 await insert('public.organizations',{id:f.org,name:'AUDIT_ORG',type:'laboratory'});
 for(const l of [a.lab1,a.lab2,a.collector])await insert('public.laboratory_profiles',{id:l,organization_id:f.org,license_number:'AUDIT_'+l.slice(-4)});
 for(const [b,name] of [[f.b1,'AUDIT_BRANCH_1'],[f.b2,'AUDIT_BRANCH_2']])await insert('public.laboratory_branches',{id:b,organization_id:f.org,display_name:name});
 for(const [b,p,r] of [[f.b1,a.lab1,'member'],[f.b2,a.lab2,'member'],[f.b1,a.collector,'collector']])await insert('public.laboratory_branch_members',{branch_id:b,profile_id:p,role_in_branch:r});
 for(const [rid,p,d,status,creator] of [[f.rel1,a.p1,a.d1,'active',a.d1],[f.rel2,a.p2,a.d2,'active',a.d2],[f.pending,a.p2,a.d1,'pending',a.d1]])await insert('public.patient_doctor_relationships',{id:rid,patient_id:p,doctor_id:d,status,created_by:creator});
 for(const [t,name] of [[f.test,'AUDIT_NUMERIC'],[f.otherTest,'AUDIT_OTHER']])await insert('public.test_definitions',{id:t,internal_code:name,name,category:'audit',default_unit:'g/L',value_type:'numeric'});
 for(const [oid,p,d,l,b,status] of [[f.o1,a.p1,a.d1,a.lab1,f.b1,'completed'],[f.o2,a.p2,a.d2,a.lab2,f.b2,'completed'],[f.o3,a.p1,a.d1,a.lab1,f.b1,'in_progress']]){
  await insert('public.lab_orders',{id:oid,patient_id:p,doctor_id:d,laboratory_id:l,laboratory_branch_id:b,status,received_at:'2026-01-01T00:00:00Z'});
  await insert('public.lab_order_items',{lab_order_id:oid,test_definition_id:f.test});
 }
 for(const [rid,oid,l,status] of [[f.r1,f.o1,a.lab1,'final'],[f.r2,f.o2,a.lab2,'final'],[f.r3,f.o3,a.lab1,'draft']])await insert('public.diagnostic_reports',{id:rid,lab_order_id:oid,laboratory_id:l,entered_by:l,status,finalized_by:status==='final'?l:null,finalized_at:status==='final'?'2026-01-01T00:00:00Z':null});
 for(const [oid,rid,l,status] of [[f.obs1,f.r1,a.lab1,'final'],[f.obs2,f.r2,a.lab2,'final'],[f.obs3,f.r3,a.lab1,'preliminary']])await insert('public.observations',{id:oid,diagnostic_report_id:rid,test_definition_id:f.test,value_numeric:12,unit:'g/L',entered_by:l,status});
 await insert('public.doctor_notes',{id:f.note,patient_id:a.p1,doctor_id:a.d1,diagnostic_report_id:f.r1,content:'AUDIT_PRIVATE_NOTE'});
 await insert('public.prescriptions',{id:f.rx,patient_id:a.p1,doctor_id:a.d1,diagnostic_report_id:f.r1});
 await insert('public.prescription_items',{id:f.rxItem,prescription_id:f.rx,medication_name:'AUDIT_MEDICINE',dosage:'1',frequency:'daily'});
 await insert('public.ai_analyses',{id:f.ai,patient_id:a.p1,diagnostic_report_id:f.r1,input_snapshot:{audit:true},prompt_version:'audit',output:'AUDIT_UNAPPROVED',analysis_type:'audit',model:'audit'});
 await insert('public.consents',{id:f.consent,patient_id:a.p1,consent_type:'physician_voice_recording',granted:true});
 await insert('public.visits',{id:f.visit,patient_id:a.p1,doctor_id:a.d1,status:'completed'});
 const audioPath=`${a.d1}/${f.voice}/${a.p1}.webm`;
 await insert('public.voice_notes',{id:f.voice,visit_id:f.visit,patient_id:a.p1,doctor_id:a.d1,audio_path:audioPath,duration:40});
 await insert('storage.objects',{bucket_id:'pab-voice-notes',name:audioPath,metadata:{size:128,mimetype:'audio/webm'}});
 await insert('public.visit_summaries',{id:f.summary,voice_note_id:f.voice,summary:'AUDIT_DRAFT',structured_content:{clinical_assessment:'AUDIT_DRAFT'}});
 await insert('public.notifications',{id:f.notification,recipient_id:a.p1,type:'audit',title:'AUDIT_NOTIFICATION'});
 await insert('public.attachments',{id:f.attachment,diagnostic_report_id:f.r1,uploaded_by:a.lab1,storage_path:`${a.lab1}/${f.r1}/audit.pdf`,file_name:'audit.pdf',file_type:'application/pdf',file_size_bytes:128});
 await insert('public.guest_result_accesses',{id:f.guest,diagnostic_report_id:f.r1,created_by:a.lab1,token_hash:'a'.repeat(64),expires_at:'2099-01-01T00:00:00Z'});
 await db.exec("insert into public.pas_record_access(patient_id,doctor_id,scopes) select patient_id,doctor_id,array['labs','medications','visits','follow_ups','diagnostics'] from public.patient_doctor_relationships where status='active' on conflict do nothing");
 await db.exec('commit;');
}

async function snapshot(){
 const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
 const entries=[];
 for(const {tablename} of tables)entries.push([tablename,(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text as data from public.${qi(tablename)} t`)).rows[0].data]);
 return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
async function test(name,actor,sql,expect,after=null){
 let out={case_id:name,actor,expected:typeof expect==='string'?expect:'predicate'};
 traces.push({name,actor,sql,expected:out.expected});
 await db.exec('begin;');
 try{
  const role=actor==='anon'?'anon':'authenticated';
  await db.exec(`set local session authorization authenticator; set local role ${role};`);
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(role==='anon'?{role}:{sub:a[actor],role,aal:'aal1'})]);
  const ctx=(await db.query('select current_user,session_user,public.is_service_role() as privileged')).rows[0];
  if(ctx.privileged || ctx.session_user!=='authenticator')throw new Error('INVALID_TEST_IDENTITY');
  let r;
  for(const query of Array.isArray(sql)?sql:[sql])r=await db.query(query);
  await db.exec('set constraints all immediate;');
  out.actual_rows=r.rows.length;out.affected_rows=r.affectedRows;
  out.passed=expect==='denied'?(r.affectedRows===0&&r.rows.length===0):expect==='zero'?Number(r.rows[0]?.n)===0:expect==='one'?Number(r.rows[0]?.n)===1:expect==='mutation'?r.affectedRows>0:typeof expect==='function'?Boolean(expect(r)):false;
  if(after){const check=await db.query(after);out.after=check.rows;out.passed&&=Boolean(check.rows[0]?.ok);}
 }catch(e){
  out.sqlstate=e.code??null;out.message=e.message;
  out.passed=expect && typeof expect==='object' && Array.isArray(expect.errors) ? (expect.errors.includes(e.code) && (!expect.messageIncludes || e.message.includes(expect.messageIncludes))) : expect==='denied'&&['42501','P0001'].includes(e.code);
 }finally{await db.exec('rollback; set session authorization postgres; reset role;');}
 results.push(out);
 console.log(JSON.stringify(out));
}
const count=(table,where='true')=>`select count(*)::integer as n from public.${table} where ${where}`;
const eq=(col,val)=>`${col}=${lit(val)}`;

if (!process.env.PAS_SECURITY_IMPORT_ONLY) {
try{
 await db.exec(fs.readFileSync(path.join(root,'tests/security/fixtures/schema.sql'),'utf8'));
 await db.exec('set check_function_bodies=on;');
 for(const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
 }
 if(Number((await db.query('select count(*) as n from public.profiles')).rows[0].n)===0)await fixtures();
 await db.exec('create table public.security_future_privilege_probe(id integer);');
 const before=await snapshot();
 console.log(JSON.stringify({fixtures:'ok',actors:Object.keys(a).length}));
 await test('future_tables_do_not_inherit_unsafe_data_api_grants','p1',"select not bool_or(has_table_privilege(actor, 'public.security_future_privilege_probe', privilege)) as ok from unnest(array['anon','authenticated']) actor cross join unnest(array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege",r=>r.rows[0]?.ok===true);
 for(const role of ['p1','p2','d2','lab2']){
  for(const [table,where] of [['doctor_notes',eq('id',f.note)],['voice_notes',eq('id',f.voice)],['visit_summaries',eq('id',f.summary)]])await test(`${role}_private_${table}_hidden`,role,count(table,where),'zero');
 }
 for(const [name,actor,table,where,expected] of [
  ['patient_other_lab_results','p2','observations',eq('id',f.obs1),'zero'],
  ['patient_own_final_result','p1','observations',eq('id',f.obs1),'one'],
  ['patient_own_preliminary_hidden','p1','observations',eq('id',f.obs3),'zero'],
  ['patient_own_draft_report_hidden','p1','diagnostic_reports',eq('id',f.r3),'zero'],
  ['patient_unapproved_ai_hidden','p1','ai_analyses',eq('id',f.ai),'zero'],
  ['doctor_own_private_note','d1','doctor_notes',eq('id',f.note),'one'],
  ['unrelated_doctor_final_result','d2','observations',eq('id',f.obs1),'zero'],
  ['other_laboratory_final_result','lab2','observations',eq('id',f.obs1),'zero'],
 ])await test(name,actor,count(table,where),expected);
 await test('patient_cannot_become_admin','p1',`update public.profiles set role='admin' where id=${lit(a.p1)} returning id`,'denied');
 await test('patient_cannot_change_national_id','p1',`update public.profiles set national_id='AUDIT_CHANGED' where id=${lit(a.p1)} returning id`,'denied');
 await test('patient_cannot_change_phone','p1',`update public.profiles set phone='+10000000000' where id=${lit(a.p1)} returning id`,'denied');
 await test('doctor_cannot_self_verify','unverified',`update public.doctor_profiles set is_verified=true where id=${lit(a.unverified)} returning id`,'denied');
 await test('doctor_cannot_change_license','d1',`update public.doctor_profiles set medical_license_number='AUDIT_REPLACED' where id=${lit(a.d1)} returning id`,'denied');
 await test('patient_profile_update_allowed','p1',`update public.profiles set full_name='AUDIT_UPDATED' where id=${lit(a.p1)} returning id`,'mutation',`select full_name='AUDIT_UPDATED' as ok from public.profiles where id=${lit(a.p1)}`);
 await test('doctor_self_approve_pending_relationship_denied','d1',`update public.patient_doctor_relationships set status='active' where id=${lit(f.pending)} returning id`,'denied');
 await test('unrelated_patient_cannot_approve_request','p1',`select public.respond_to_doctor_request(${lit(f.pending)},'accept')`,'denied');
 await test('patient_approves_own_request','p2',`select public.respond_to_doctor_request(${lit(f.pending)},'accept') as data`,r=>r.rows[0]?.data?.ok===true,`select status='active' as ok from public.patient_doctor_relationships where id=${lit(f.pending)}`);
 await test('doctor_cannot_change_relationship_identity','d1',`update public.patient_doctor_relationships set patient_id=${lit(a.p1)} where id=${lit(f.pending)} returning id`,'denied');
 await test('patient_cannot_modify_results','p1',`update public.observations set value_numeric=999 where id=${lit(f.obs1)} returning id`,'denied');
 await test('lab_final_value_is_immutable','lab1',`update public.observations set value_numeric=999 where id=${lit(f.obs1)} returning id`,'denied');
 await test('collector_cannot_change_results','collector',`update public.observations set status='superseded' where id=${lit(f.obs1)} returning id`,'denied');
 await test('collector_cannot_finalize_report','collector',`update public.diagnostic_reports set status='amended' where id=${lit(f.r3)} returning id`,'denied');
 await test('other_lab_cannot_modify_report','lab2',`update public.diagnostic_reports set status='amended' where id=${lit(f.r3)} returning id`,'denied');
 await test('patient_cannot_mutate_other_notification','p2',`update public.notifications set is_read=true where id=${lit(f.notification)} returning id`,'denied');
 await test('patient_cannot_rewrite_notification','p1',`update public.notifications set title='AUDIT_FORGED' where id=${lit(f.notification)} returning id`,'denied');
 await test('patient_marks_own_notification_read','p1',`update public.notifications set is_read=true where id=${lit(f.notification)} returning id`,'mutation');
 await test('doctor_cannot_forge_patient_consent','d1',`insert into public.consents(patient_id,consent_type,granted) values(${lit(a.p1)},'physician_voice_recording',true) returning id`,'denied');
 await test('patient_revokes_own_consent','p1',`update public.consents set granted=false where id=${lit(f.consent)} returning id`,'mutation',`select not granted and revoked_at is not null as ok from public.consents where id=${lit(f.consent)}`);
 await test('patient_cannot_forge_audit_log','p1',`insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(${lit(a.p1)},'AUDIT_FAKE','profile',${lit(a.p1)}) returning id`,'denied');
 await test('patient_cannot_delete_audit_logs','p1',`delete from public.audit_logs where actor_id=${lit(a.p1)} returning id`,'denied');
 await test('doctor_cannot_forge_ai_approval_for_patient','d2',`update public.ai_analyses set review_status='approved',is_visible_to_patient=true,reviewed_by=${lit(a.d2)} where id=${lit(f.ai)} returning id`,'denied');
 await test('doctor_cannot_publish_unapproved_ai','d1',`update public.ai_analyses set is_visible_to_patient=true,reviewed_by=${lit(a.d1)} where id=${lit(f.ai)} returning id`,'denied');
 await test('lab_cannot_extend_guest_link_expiry','lab1',`update public.guest_result_accesses set expires_at='2100-01-01' where id=${lit(f.guest)} returning id`,'denied');
 await test('lab_cannot_reset_guest_access_counter','lab1',`update public.guest_result_accesses set access_count=99 where id=${lit(f.guest)} returning id`,'denied');
 for(const actor of ['p1','d1','lab1'])await test(`${actor}_admin_rpc_denied`,actor,'select * from public.admin_list_laboratory_organizations()','denied');
 await test('anon_rpc_denied','anon','select * from public.admin_list_laboratory_organizations()','denied');
 await test('patient_cannot_touch_guest_access','p1',`select * from public.touch_guest_result_access(${lit(f.guest)})`,'denied');
 await test('lab_cannot_attach_pdf_to_other_report','lab1',`insert into public.attachments(diagnostic_report_id,uploaded_by,storage_path,file_name,file_type,file_size_bytes) values(${lit(f.r2)},${lit(a.lab1)},${lit(a.lab1+'/'+f.r2+'/audit.pdf')},'audit.pdf','application/pdf',128) returning id`,'denied');
 await test('lab_rejects_non_pdf_metadata','lab1',`insert into public.attachments(diagnostic_report_id,uploaded_by,storage_path,file_name,file_type,file_size_bytes) values(${lit(f.r1)},${lit(a.lab1)},${lit(a.lab1+'/'+f.r1+'/audit.html')},'audit.html','text/html',128) returning id`,'denied');
 await test('lab_rejects_oversized_pdf_metadata','lab1',`insert into public.attachments(diagnostic_report_id,uploaded_by,storage_path,file_name,file_type,file_size_bytes) values(${lit(f.r1)},${lit(a.lab1)},${lit(a.lab1+'/'+f.r1+'/audit.pdf')},'audit.pdf','application/pdf',10485761) returning id`,'denied');
 await test('unrelated_doctor_cannot_create_prescription','d2',`insert into public.prescriptions(patient_id,doctor_id) values(${lit(a.p1)},${lit(a.d2)}) returning id`,'denied');
 await test('doctor_cannot_create_prescription_for_other_report','d1',`insert into public.prescriptions(patient_id,doctor_id,diagnostic_report_id) values(${lit(a.p1)},${lit(a.d1)},${lit(f.r2)}) returning id`,'denied');
 // These are security requirements; an unexpected successful write is a finding.
 await test('draft_cannot_skip_finalization_to_amended','lab1',`update public.diagnostic_reports set status='amended' where id=${lit(f.r3)} returning id,status,finalized_at`,'denied');
 await test('final_result_cannot_disappear_without_correction','lab1',`update public.observations set status='superseded' where id=${lit(f.obs1)} returning id`,'denied');
 await test('prescription_cannot_be_rebound_to_another_patient_report','d1',`update public.prescriptions set diagnostic_report_id=${lit(f.r2)} where id=${lit(f.rx)} returning id,diagnostic_report_id`,'denied');
 await test('prescription_issued_at_is_immutable','d1',`update public.prescriptions set issued_at='2000-01-01' where id=${lit(f.rx)} returning id,issued_at`,'denied');
 await test('doctor_can_cancel_own_prescription','d1',`update public.prescriptions set status='cancelled' where id=${lit(f.rx)} returning id`,'mutation',`select status='cancelled' as ok from public.prescriptions where id=${lit(f.rx)}`);

 await test('atomic_result_save_and_finalization_succeeds','lab1',`select public.save_lab_results_atomic(${lit(f.o3)},${lit(f.r3)},${lit(JSON.stringify([{test_definition_id:f.test,has_value:true,value_numeric:15}]))}::jsonb,true) as data`,r=>r.rows[0]?.data?.ok===true&&r.rows[0]?.data?.status==='final',`select dr.status='final' and dr.finalized_at is not null and lo.status='completed' and exists(select 1 from public.observations o where o.diagnostic_report_id=dr.id and o.status='final' and o.value_numeric=15) as ok from public.diagnostic_reports dr join public.lab_orders lo on lo.id=dr.lab_order_id where dr.id=${lit(f.r3)}`);
 await test('atomic_correction_keeps_valid_successor','lab1',`select public.correct_lab_observation(${lit(f.r1)},${lit(f.obs1)},13,null,null) as id`,r=>Boolean(r.rows[0]?.id),`select old.status='superseded' and replacement.status='corrected' and replacement.value_numeric=13 and replacement.unit=old.unit as ok from public.observations old join public.observations replacement on replacement.supersedes_observation_id=old.id where old.id=${lit(f.obs1)}`);
 await test('successive_corrections_preserve_the_complete_history','lab1',[
  `select public.correct_lab_observation(${lit(f.r1)},${lit(f.obs1)},13,null,null) as id`,
  `select public.correct_lab_observation(${lit(f.r1)},(select id from public.observations where supersedes_observation_id=${lit(f.obs1)} and status='corrected'),14,null,null) as id`,
 ],r=>Boolean(r.rows[0]?.id),`select count(*) filter(where status='superseded')=2 and count(*) filter(where status='corrected')=1 as ok from public.observations where diagnostic_report_id=${lit(f.r1)}`);
 await test('direct_publication_without_atomic_order_completion_denied','lab1',`update public.diagnostic_reports set status='final',finalized_by=${lit(a.lab1)},finalized_at=now() where id=${lit(f.r3)} returning id`,'denied');
 await test('final_report_cannot_become_draft','lab1',`update public.diagnostic_reports set status='draft' where id=${lit(f.r1)} returning id`,'denied');
 await test('collector_cannot_use_correction_rpc','collector',`select public.correct_lab_observation(${lit(f.r1)},${lit(f.obs1)},13,null,null)`,'denied');
 await test('collector_cannot_use_finalization_rpc','collector',`select public.finalize_lab_report(${lit(f.r3)})`,'denied');
 for(const role of ['manager','laboratory_staff','reception','collector','member']){
  await test('admin_assigns_supported_branch_role_'+role,'admin',`select public.admin_set_laboratory_branch_member(${lit(f.b1)},${lit(a.lab2)},${lit(role)},true) as id`,r=>Boolean(r.rows[0]?.id));
 }
 const after=await snapshot();
 const report={engine:(await db.query('select version() as version')).rows[0].version,identity_mode:'session_user=authenticator,current_user=authenticated; is_service_role=false',fixture_data_only:true,rollback_verified:before===after,tests:results};
 fs.writeFileSync(output+'/database.json',JSON.stringify(report,null,2));
 fs.writeFileSync(output+'/cases.json',JSON.stringify(traces,null,2));
 if(results.some(r=>!r.passed)||before!==after)process.exitCode=1;
 console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.case_id),rollback_verified:before===after}));
}catch(e){console.log(JSON.stringify({fatal:true,code:e.code,message:e.message,detail:e.detail,where:e.where,query:e.query?.slice(0,300)}));process.exitCode=1;try{await db.exec('rollback;');}catch{}}
finally{await db.close();}

}
export {db,a,f,id,insert,fixtures,snapshot,test,results};
