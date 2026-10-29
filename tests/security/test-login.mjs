import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const adminId='a0000000-0000-4000-8000-000000000004';
const base={NODE_ENV:'production',ENABLE_TEST_LOGIN:'true',PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'true',PAS_TEST_LOGIN_PASSWORD:'FIXTURE_ACCESS_123456789',PAS_TEST_AUTH_PASSWORD:'FIXTURE_AUTH_987654321',PAS_DEMO_ADMIN_LOGIN_PASSWORD:'FIXTURE_ADMIN_111222333',PAS_TEST_ADMIN_USER_ID:adminId};
const identities={patient:['1272511677','989120000000'],doctor:['12345','989130000000'],laboratory:['LAB-1234','989140000000'],admin:['admin','989150000000']};
const results=[];
async function run(name,{role='patient',env={},input,profilePatch={},userId,patientCompleted=true,authError=false,throwAuth=false,profileError=false,expectedCode,expectedPath,expectNoAuth=false}={}) {
 const profile={id:role==='admin'?adminId:'a0000000-0000-4000-8000-000000000001',role,phone:identities[role][1],doctor_profiles:{medical_license_number:'12345',is_verified:true},laboratory_profiles:{license_number:'LAB-1234',organization_id:'a0000000-0000-4000-8000-000000000010'},...profilePatch};
 let calls=0,clears=0;
 const client={auth:{signOut:async()=>{clears++;return{}},signInWithPassword:async credentials=>{
  calls++;assert.equal(credentials.password,base.PAS_TEST_AUTH_PASSWORD);assert.equal(credentials.phone,'+'+identities[role][1]);
  if(throwAuth)throw new Error('Fixture transport error');
  return {data:authError?{user:null}:{user:{id:userId??profile.id}},error:authError?{code:'invalid_credentials'}:null};
 }},from:table=>({select(){return this},eq(){return this},async single(){return {data:profileError?null:profile,error:profileError?{code:'fixture'}:null}},async maybeSingle(){assert.equal(table,'patient_profiles');return {data:patientCompleted?{id:profile.id}:null,error:null}}})};
 const context=vm.createContext({process:{env:{...base,...env}},Date,URL,Map,Set,console:{error(){}}});const cache=new Map();
 async function get(file){
  if(cache.has(file))return cache.get(file);
  const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);
  await m.link(async(spec,ref)=>{
   if(spec==='server-only')return new vm.SyntheticModule([],()=>{},{context});
   if(spec==='@/lib/supabase/server')return new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',async()=>client)},{context});
   let target=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(ref.identifier),spec);
   if(target===path.join(root,'lib/auth'))target+='/index.js';else if(!path.extname(target))target+='.js';
   assert.ok(target.startsWith(root+'/'));return get(target);
  });return m;
 }
 const m=await get(path.join(root,'features/auth/test-actions.js'));await m.evaluate();
 const args=input===undefined?{identifier:identities[role][0],password:role==='admin'?base.PAS_DEMO_ADMIN_LOGIN_PASSWORD:base.PAS_TEST_LOGIN_PASSWORD,loginContext:role==='admin'?'admin':'public'}:input;
 const value=await m.namespace.loginTestUser(args);
 if(expectedCode) {assert.equal(value.ok,false,name);assert.equal(value.code,expectedCode,name);}
 else {assert.equal(value.ok,true,name);assert.equal(value.redirectTo,expectedPath,name);}
 if(expectNoAuth)assert.equal(calls,0,name);
 if(calls&&expectedCode)assert.ok(clears>=2,name);
 results.push({case_id:name,passed:true});
}
for(const [role,expectedPath] of [['patient','/patient/dashboard'],['doctor','/doctor/dashboard'],['laboratory','/lab/dashboard'],['admin','/admin']])await run('valid_'+role,{role,expectedPath});
await run('incomplete_patient_goes_to_onboarding',{patientCompleted:false,expectedPath:'/patient/complete-profile'});
await run('explicit_disable_blocks_direct_action',{env:{ENABLE_TEST_LOGIN:'false'},expectedCode:'NOT_AVAILABLE',expectNoAuth:true});
await run('production_requires_owner_opt_in',{env:{PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'false'},expectedCode:'NOT_AVAILABLE',expectNoAuth:true});
await run('null_payload_rejected',{input:null,expectedCode:'INVALID_INPUT',expectNoAuth:true});
await run('non_string_identity_rejected',{input:{identifier:{},password:base.PAS_TEST_LOGIN_PASSWORD},expectedCode:'INVALID_INPUT',expectNoAuth:true});
await run('wrong_access_code_rejected',{input:{identifier:identities.patient[0],password:'wrong'},expectedCode:'INVALID_INPUT',expectNoAuth:true});
await run('public_context_rejects_admin',{role:'admin',input:{identifier:'admin',password:base.PAS_DEMO_ADMIN_LOGIN_PASSWORD,loginContext:'public'},expectedCode:'INVALID_INPUT',expectNoAuth:true});
await run('admin_context_rejects_patient',{input:{identifier:identities.patient[0],password:base.PAS_TEST_LOGIN_PASSWORD,loginContext:'admin'},expectedCode:'INVALID_INPUT',expectNoAuth:true});
await run('admin_requires_pinned_auth_identity',{role:'admin',userId:'a0000000-0000-4000-8000-000000000099',expectedCode:'INVALID_INPUT'});
await run('database_role_mismatch_clears_session',{profilePatch:{role:'doctor'},expectedCode:'INVALID_INPUT'});
await run('database_phone_mismatch_clears_session',{profilePatch:{phone:'989100000099'},expectedCode:'INVALID_INPUT'});
await run('unverified_doctor_rejected',{role:'doctor',profilePatch:{doctor_profiles:{medical_license_number:'12345',is_verified:false}},expectedCode:'INVALID_INPUT'});
await run('laboratory_license_mismatch_rejected',{role:'laboratory',profilePatch:{laboratory_profiles:{license_number:'OTHER'}},expectedCode:'INVALID_INPUT'});
await run('missing_profile_clears_session',{profileError:true,expectedCode:'SERVER_ERROR'});
await run('transport_exception_returns_controlled_error',{throwAuth:true,expectedCode:'SERVER_ERROR'});
// Non-admin requests must stop before privileged directory access.
for(const role of ['patient','doctor','laboratory']) {
 const ctx=vm.createContext({});let privilegedCalls=0;
 const m=new vm.SourceTextModule(fs.readFileSync(path.join(root,'lib/auth/admin.js'),'utf8'),{context:ctx});
 await m.link(async spec=>{
  if(spec==='server-only')return new vm.SyntheticModule([],()=>{},{context:ctx});
  if(spec==='@/lib/auth/server')return new vm.SyntheticModule(['getSessionUser'],function(){this.setExport('getSessionUser',async()=>({id:adminId,role}))},{context:ctx});
  if(spec==='@/lib/supabase/admin')return new vm.SyntheticModule(['createAdminClient'],function(){this.setExport('createAdminClient',()=>{privilegedCalls++;throw new Error('Privileged access must not occur')})},{context:ctx});
  throw new Error('Unexpected dependency');
 });await m.evaluate();
 await assert.rejects(()=>m.namespace.requireAdmin(),e=>e.message==='ADMIN_FORBIDDEN');assert.equal(privilegedCalls,0);
 results.push({case_id:role+'_stops_before_privileged_directory',passed:true});
}
fs.mkdirSync(path.join(root,'.security-results'),{recursive:true});
fs.writeFileSync(path.join(root,'.security-results/test-login.json'),JSON.stringify({method:'Actual Server Action with deterministic Supabase fixtures; no hosted writes.',tests:results},null,2));
console.log(JSON.stringify({total:results.length,passed:results.length}));
