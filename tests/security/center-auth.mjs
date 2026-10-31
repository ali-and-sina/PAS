import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {z} from 'zod';
const root=path.resolve(import.meta.dirname,'../..');
const uid='a0000000-0000-4000-8000-000000000201',adminId='a0000000-0000-4000-8000-000000000009';
const results=[];
async function fixture(options={}){
 const calls={signIn:[],create:[],provision:[],delete:[],clears:0,admin:0};
 const user=options.user===undefined?{id:uid,role:'medical_center',center_type:'mri',center_active:true}:options.user;
 const client={auth:{signInWithPassword:async input=>{calls.signIn.push(input);if(options.transportError)throw new Error('fixture');return {data:{user:{id:uid}},error:options.authError?{code:'invalid_credentials'}:null}},signOut:async()=>{calls.clears++;return {}}}};
 const admin={auth:{admin:{createUser:async input=>{calls.create.push(input);return {data:{user:{id:uid}},error:options.createError?{code:'phone_exists'}:null}},deleteUser:async id=>{calls.delete.push(id);return {}}}},rpc:async(name,input)=>{calls.provision.push({name,input});return {data:{id:uid},error:options.provisionError?{code:'23505'}:null}}};
 const context=vm.createContext({console:{error(){}},Date,URL,Set,Map});const cache=new Map();
 function synthetic(names,values){return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,values[name])},{context});}
 async function get(file){
  if(cache.has(file))return cache.get(file);
  const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);
  await m.link(async(spec,ref)=>{
   if(spec==='server-only')return synthetic([],{});
   if(spec==='zod')return synthetic(['z'],{z});
   if(spec==='next/cache')return synthetic(['revalidatePath'],{revalidatePath(){}});
   if(spec==='@/lib/auth/admin')return synthetic(['requireAdmin'],{requireAdmin:async()=>{if(options.forbidden)throw new Error('ADMIN_FORBIDDEN');return {id:adminId}}});
   if(spec==='@/lib/auth/server')return synthetic(['getSessionUser'],{getSessionUser:async()=>user});
   if(spec==='@/lib/supabase/server')return synthetic(['createClient'],{createClient:async()=>client});
   if(spec==='@/lib/supabase/admin')return synthetic(['createAdminClient'],{createAdminClient:()=>{calls.admin++;return admin}});
   let target=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(ref.identifier),spec);if(!path.extname(target))target+='.js';assert.ok(target.startsWith(root+'/'));return get(target);
  });return m;
 }
 const m=await get(root+'/features/centers/actions.js');await m.evaluate();return {actions:m.namespace,calls};
}
const input={full_name:'AUDIT manager',display_name:'AUDIT center',phone:'09120000001',license_number:'AUDIT-MRI',center_type:'mri',password:'FIXTURE_PASSWORD_123456'};
async function run(name,work){await work();results.push({case_id:name,passed:true});}
for(const type of ['laboratory','radiology','mri','ct','ultrasound','mammography','ecg','physiotherapy','other']){
 await run('password_login_redirect_'+type,async()=>{
  const {actions,calls}=await fixture({user:{id:uid,role:type==='laboratory'?'laboratory':'medical_center',center_type:type,center_active:true}});
  const result=await actions.loginMedicalCenter({phone:'۰۹۱۲۰۰۰۰۰۰۱',password:input.password});
  assert.equal(result.ok,true);assert.equal(result.redirectTo,type==='laboratory'?'/lab/dashboard':'/center/'+type+'/dashboard');assert.equal(calls.admin,0);assert.equal(calls.signIn[0].phone,'+989120000001');
 });
 await run('admin_provision_'+type,async()=>{
  const {actions,calls}=await fixture();const result=await actions.createMedicalCenter({...input,center_type:type,actor_id:'forged'});
  assert.equal(result.ok,true);assert.equal(calls.provision[0].input.p_type,type);assert.equal(calls.provision[0].input.p_actor,adminId);assert.equal(calls.create[0].phone_confirm,true);assert.equal(calls.create[0].password,input.password);assert.equal(JSON.stringify(calls.create[0].user_metadata).includes(input.password),false);assert.equal(JSON.stringify(result).includes(input.password),false);
 });
}
for(const [name,user] of [['patient',{id:uid,role:'patient'}],['doctor',{id:uid,role:'doctor'}],['inactive',{id:uid,role:'medical_center',center_type:'mri',center_active:false}],['unclassified',{id:uid,role:'medical_center',center_active:true}],['auth_id_mismatch',{id:adminId,role:'medical_center',center_type:'mri',center_active:true}]])await run('password_login_reject_'+name,async()=>{const {actions,calls}=await fixture({user});assert.equal((await actions.loginMedicalCenter({phone:input.phone,password:input.password})).ok,false);assert.equal(calls.clears,1);assert.equal(calls.admin,0);});
await run('wrong_password_does_not_authorize',async()=>{const {actions}=await fixture({authError:true});assert.equal((await actions.loginMedicalCenter({phone:input.phone,password:'wrong'})).ok,false)});
await run('transport_failure_clears_session',async()=>{const {actions,calls}=await fixture({transportError:true});assert.equal((await actions.loginMedicalCenter({phone:input.phone,password:input.password})).ok,false);assert.equal(calls.clears,1)});
await run('forbidden_provision_never_touches_admin_sdk',async()=>{const {actions,calls}=await fixture({forbidden:true});await assert.rejects(()=>actions.createMedicalCenter(input),/ADMIN_FORBIDDEN/);assert.equal(calls.admin,0)});
for(const [name,patch] of [['unknown_type',{center_type:'unlicensed'}],['short_password',{password:'1234'}],['missing_phone',{phone:''}]])await run('invalid_provision_'+name,async()=>{const {actions,calls}=await fixture();assert.equal((await actions.createMedicalCenter({...input,...patch})).ok,false);assert.equal(calls.admin,0)});
await run('database_failure_compensates_auth_creation',async()=>{const {actions,calls}=await fixture({provisionError:true});assert.equal((await actions.createMedicalCenter(input)).ok,false);assert.deepEqual(calls.delete,[uid]);});
await run('duplicate_auth_does_not_provision',async()=>{const {actions,calls}=await fixture({createError:true});assert.equal((await actions.createMedicalCenter(input)).ok,false);assert.equal(calls.provision.length,0);assert.equal(calls.delete.length,0)});

async function realSession(center, authMetadata) {
 const client={auth:{getUser:async()=>({data:{user:{id:uid,user_metadata:authMetadata}}})},from:()=>({select(){return this},eq(){return this},single:async()=>({data:{id:uid,role:'laboratory',full_name:'AUDIT manager',laboratory_profiles:{organization_id:adminId,pas_medical_centers:center}}})})};
 const context=vm.createContext({console:{error(){}}});
 const m=new vm.SourceTextModule(fs.readFileSync(root+'/lib/auth/session.js','utf8'),{context});
 await m.link(async spec=>spec==='server-only'?new vm.SyntheticModule([],()=>{},{context}):new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',async()=>client)},{context}));
 await m.evaluate();return m.namespace.getSessionUser();
}
for(const type of ['laboratory','radiology','mri','ct','ultrasound','mammography','ecg','physiotherapy','other'])await run('session_uses_trusted_database_type_'+type,async()=>{const user=await realSession({center_type:type,is_active:true,display_name:'AUDIT center'},{center_type:'laboratory',role:'admin'});assert.equal(user.role,type==='laboratory'?'laboratory':'medical_center');assert.equal(user.center_type,type)});
await run('inactive_lab_cannot_use_legacy_server_actions',async()=>{const user=await realSession({center_type:'laboratory',is_active:false},{});assert.equal(user.role,'medical_center');assert.equal(user.center_active,false)});
await run('missing_center_classification_fails_closed',async()=>{const user=await realSession(null,{center_type:'laboratory'});assert.equal(user.role,'medical_center');assert.equal(user.center_type,null)});
fs.writeFileSync(root+'/.security-results/center-auth.json',JSON.stringify({total:results.length,passed:results.length,tests:results},null,2));
console.log(JSON.stringify({total:results.length,passed:results.length}));
