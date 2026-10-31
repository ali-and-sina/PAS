import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {File} from 'node:buffer';
const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output=path.join(sourceRoot,'.security-results');
fs.mkdirSync(output,{recursive:true});
const results=[];
function check(name,actual,expected){results.push({case_id:name,passed:Object.is(actual,expected),actual,expected});}
async function moduleFrom(relative,env={}){
 const context=vm.createContext({process:{env},Date,console:{error(){},warn(){}},URL,Set,Map});
 const cache=new Map();
 async function get(file){
  if(cache.has(file))return cache.get(file);
  const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);
  await m.link(async(spec,ref)=>{
   if(spec==='server-only')return new vm.SyntheticModule([],()=>{},{context});
   let resolved=path.resolve(path.dirname(ref.identifier),spec);if(!path.extname(resolved))resolved+='.js';
   if(!resolved.startsWith(sourceRoot+'/'))throw new Error('Unexpected source import');
   return get(resolved);
  });return m;
 }
 const m=await get(sourceRoot+'/'+relative);await m.evaluate();return m.namespace;
}
const redirects=await moduleFrom('lib/auth/redirects.js');
for(const [i,input] of [null,undefined,0,{},[],false,'','patient','https://example.invalid/','//example.invalid','/\\example.invalid','/auth','/auth/callback','/auth/signout','/login','/login?next=/admin','/doctor\n/admin','javascript:alert(1)','data:text/html,hi','/'+ 'a'.repeat(2049)].entries())check('redirect_reject_'+i,redirects.sanitizeNext(input),null);
for(const [i,input] of ['/doctor/patients','/patient/results?sort=asc','/admin/users#top'].entries())check('redirect_accept_internal_'+i,redirects.sanitizeNext(input),input);
check('redirect_prevents_role_crossing',redirects.resolvePostLoginTarget({redirectTo:'/patient/dashboard',next:'/admin'}),'/patient/dashboard');
check('redirect_preserves_onboarding',redirects.resolvePostLoginTarget({redirectTo:'/patient/complete-profile',next:'/patient/dashboard'}),'/patient/complete-profile');
check('redirect_preserves_verification',redirects.resolvePostLoginTarget({redirectTo:'/doctor/pending-verification',next:'/doctor/dashboard'}),'/doctor/pending-verification');
check('redirect_accepts_role_destination',redirects.resolvePostLoginTarget({redirectTo:'/doctor/dashboard',next:'/doctor/patients'}),'/doctor/patients');
const base={ENABLE_TEST_LOGIN:'true',PAS_TEST_LOGIN_PASSWORD:'AUDIT_ONLY_ACCESS_123456789',PAS_TEST_AUTH_PASSWORD:'AUDIT_ONLY_AUTH_987654321'};
const future=days=>new Date(Date.now()+days*86400000).toISOString();
const demoCases=[
 ['default_disabled',{},false],
 ['development_enabled',{...base,NODE_ENV:'development'},true],
 ['development_missing_secret',{...base,NODE_ENV:'development',PAS_TEST_AUTH_PASSWORD:''},false],
 ['shared_secrets_rejected',{...base,NODE_ENV:'development',PAS_TEST_AUTH_PASSWORD:base.PAS_TEST_LOGIN_PASSWORD},false],
 ['production_disabled',{...base,NODE_ENV:'production'},false],
 ['production_owner_enabled_without_expiry',{...base,NODE_ENV:'production',PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'true'},true],
 ['production_short_window',{...base,NODE_ENV:'production',PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'true',PAS_DEMO_LOGIN_EXPIRES_AT:future(1)},true],
 ['production_expired',{...base,NODE_ENV:'production',PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'true',PAS_DEMO_LOGIN_EXPIRES_AT:future(-1)},false],
 ['production_long_window',{...base,NODE_ENV:'production',PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'true',PAS_DEMO_LOGIN_EXPIRES_AT:future(15)},true],
 ['production_invalid_timestamp',{...base,NODE_ENV:'production',PAS_ALLOW_PRODUCTION_DEMO_LOGIN:'true',PAS_DEMO_LOGIN_EXPIRES_AT:'tomorrow'},false],
 ['test_environment_disabled',{...base,NODE_ENV:'test'},false],
];
for(const [name,env,want] of demoCases){const m=await moduleFrom('lib/auth/test-session.js',env);check('demo_'+name,m.isTestLoginEnabled(),want);}
const adminEnv={...base,NODE_ENV:'development',PAS_DEMO_ADMIN_LOGIN_PASSWORD:'AUDIT_ONLY_ADMIN_4444444444',PAS_TEST_ADMIN_USER_ID:'a0000000-0000-4000-8000-000000000004'};
const demo=await moduleFrom('lib/auth/test-session.js',adminEnv);
check('demo_wrong_password',demo.getTestUserCredentials(demo.TEST_USERS.patient.identifier,'WRONG'),null);
check('demo_admin_rejects_public_password',demo.getTestUserCredentials(demo.TEST_USERS.admin.identifier,base.PAS_TEST_LOGIN_PASSWORD),null);
check('demo_admin_separate_password',demo.getTestUserCredentials(demo.TEST_USERS.admin.identifier,adminEnv.PAS_DEMO_ADMIN_LOGIN_PASSWORD)?.role,'admin');
check('demo_unknown_identity',demo.getTestUserCredentials('AUDIT_UNKNOWN',base.PAS_TEST_LOGIN_PASSWORD),null);
for(const input of [null,{},[],123])check('demo_malformed_'+JSON.stringify(input),demo.getTestUserCredentials(input,base.PAS_TEST_LOGIN_PASSWORD),null);
check('demo_secret_flag_off',(await moduleFrom('lib/auth/test-session.js',{...adminEnv,ENABLE_TEST_LOGIN:'false'})).isAdminTestLoginEnabled(),false);
check('demo_admin_requires_pinned_id',(await moduleFrom('lib/auth/test-session.js',{...adminEnv,PAS_TEST_ADMIN_USER_ID:''})).isAdminTestLoginEnabled(),false);

const dateLabels=await moduleFrom('lib/utils/date-time.js');
for(const [name,input,want] of [
 ['empty',null,'—'],['invalid','invalid','—'],
 ['tehran_calendar','2026-10-28T00:00:00Z','۶ آبان ۱۴۰۵'],
])check('date_'+name,dateLabels.formatPersianDate(input),want);
for(const [name,input,want] of [
 ['empty','', '—'],['tehran_time','2026-10-28T00:00:00Z','۶ آبان ۱۴۰۵، ساعت ۰۳:۳۰'],
 ['midnight_rollover','2026-10-28T22:00:00Z','۷ آبان ۱۴۰۵، ساعت ۰۱:۳۰'],
 ['explicit_offset','2026-10-28T03:30:00+03:30','۶ آبان ۱۴۰۵، ساعت ۰۳:۳۰'],
])check('datetime_'+name,dateLabels.formatPersianDateTime(input),want);
const shortCodeDemo=await moduleFrom('lib/auth/test-session.js',{...adminEnv,PAS_TEST_LOGIN_PASSWORD:'1234'});
for(const role of ['patient','doctor','laboratory'])check('demo_1234_'+role,shortCodeDemo.getTestUserCredentials(shortCodeDemo.TEST_USERS[role].identifier,'1234')?.role,role);
check('demo_1234_does_not_grant_admin',shortCodeDemo.getTestUserCredentials('admin','1234'),null);
check('demo_1234_only_when_configured',demo.getTestUserCredentials(demo.TEST_USERS.patient.identifier,'1234'),null);
check('demo_short_auth_secret_rejected',(await moduleFrom('lib/auth/test-session.js',{...adminEnv,PAS_TEST_LOGIN_PASSWORD:'1234',PAS_TEST_AUTH_PASSWORD:'1234'})).isTestLoginEnabled(),false);
check('demo_three_digit_code_rejected',(await moduleFrom('lib/auth/test-session.js',{...adminEnv,PAS_TEST_LOGIN_PASSWORD:'123'})).isTestLoginEnabled(),false);
const dates=await moduleFrom('lib/care/dates.js');
for(const [name,key,want] of [['new_year_1404','2025-03-21','1404/1/1'],['leap_esfand','2025-03-20','1403/12/30'],['new_year_1403','2024-03-20','1403/1/1']]){
 const p=dates.persianParts(key);check('jalali_'+name,[p.year,p.month,p.day].join('/'),want);
}
check('jalali_next_month',dates.moveMonth('2025-03-21',1),'2025-04-21');
check('jalali_previous_month',dates.moveMonth('2025-03-21',-1),'2025-02-19');
check('jalali_year_month_selection',dates.persianMonthKey(1404,1),'2025-03-21');
check('jalali_invalid_gregorian_rejected',dates.dayDate('2025-02-30'),null);
check('tehran_midnight_boundary',dates.tehranDayKey('2026-10-30T20:30:00Z'),'2026-10-31');
check('tehran_time_storage',dates.tehranDateTimeToISO('2026-10-30','12:00'),'2026-10-30T08:30:00.000Z');
const med=await moduleFrom('lib/care/medication.js');
const medItem={id:'AUDIT_RX_ITEM',units_per_day:1,as_needed:false};
const startDate=Date.parse('2026-01-01T08:00:00Z'),dayMs=86400000;
const receipt=(day,quantity)=>({prescription_item_id:medItem.id,received_at:new Date(startDate+day*dayMs).toISOString(),quantity_units:quantity});
check('med_no_receipt_is_orange',med.medicationCoverage(medItem,[],startDate).status,'not_received');
check('med_received_dose_active',med.medicationCoverage(medItem,[receipt(0,100)],startDate+10*dayMs).status,'active');
check('med_100_units_one_daily_end',med.medicationCoverage(medItem,[receipt(0,100)],startDate+10*dayMs).endAt,new Date(startDate+100*dayMs).toISOString());
check('med_exact_end_inactive',med.medicationCoverage(medItem,[receipt(0,100)],startDate+100*dayMs).status,'inactive');
check('med_refill_adds_remaining_stock',med.medicationCoverage(medItem,[receipt(0,100),receipt(5,5)],startDate+10*dayMs).endAt,new Date(startDate+105*dayMs).toISOString());
check('med_gap_restarts_coverage',med.medicationCoverage(medItem,[receipt(0,10),receipt(20,5)],startDate+21*dayMs).endAt,new Date(startDate+25*dayMs).toISOString());
check('med_future_receipt_not_received',med.medicationCoverage(medItem,[receipt(20,5)],startDate).status,'not_received');
check('med_prn_unknown_duration',med.medicationCoverage({...medItem,as_needed:true},[receipt(0,10)],startDate).status,'unknown');
check('med_missing_daily_rate_unknown',med.medicationCoverage({...medItem,units_per_day:null},[receipt(0,10)],startDate).status,'unknown');
check('med_active_prescription_without_receipt_not_received',med.prescriptionCoverage({status:'active'},[medItem],[],startDate).status,'not_received');
const pdfSource=fs.readFileSync(sourceRoot+'/features/lab-results/actions.js','utf8');
const start=pdfSource.indexOf('async function isPdfFile(');
const end=pdfSource.indexOf('\nasync function saveLabReportAttachment',start);
if(start<0||end<0)throw new Error('PDF function boundary missing');
const isPdfFile=vm.runInNewContext('const MAX_PDF_SIZE_BYTES=10*1024*1024;'+pdfSource.slice(start,end)+'\nisPdfFile',{Uint8Array,String});
for(const [name,file,want] of [
 ['signature_and_type',new File(['%PDF-1.7\nAUDIT'],'audit.pdf',{type:'application/pdf'}),true],
 ['html_named_pdf',new File(['<html>AUDIT</html>'],'audit.pdf',{type:'application/pdf'}),false],
 ['wrong_mime',new File(['%PDF-1.7\nAUDIT'],'audit.pdf',{type:'text/html'}),false],
 ['empty',new File([],'audit.pdf',{type:'application/pdf'}),false],
 ['truncated_header',new File(['%PDF'],'audit.pdf',{type:'application/pdf'}),false],
 ['null',null,false],
 ['forged_object',{size:128,type:'application/pdf'},false],
 ['oversized',{size:10485761,type:'application/pdf',arrayBuffer(){},slice(){}},false],
])check('pdf_'+name,await isPdfFile(file),want);
const report={method:'Executed source modules in an isolated JavaScript VM; no application HTTP requests or framework build.',tests:results};
fs.writeFileSync(output+'/source.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed)}));

if(results.some(test=>!test.passed))process.exitCode=1;
