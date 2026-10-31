import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyBridgeSignature,readBridgeBody} from '../../lib/integrations/bridge.js';
const secret='AUDIT_BRIDGE_SECRET_abcdefghijklmnopqrstuvwxyz';
const raw=JSON.stringify({event_id:'audit',title:'AUDIT'});
const now=Date.now(),timestamp=String(Math.floor(now/1000));
const signature=createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
test('signed payload is accepted',()=>assert.equal(verifyBridgeSignature({raw,timestamp,signature,secret,now}),true));
test('modified payload is rejected',()=>assert.equal(verifyBridgeSignature({raw:raw+' ',timestamp,signature,secret,now}),false));
test('expired signature is rejected',()=>assert.equal(verifyBridgeSignature({raw,timestamp,signature,secret,now:now+301000}),false));
test('malformed signature is rejected',()=>assert.equal(verifyBridgeSignature({raw,timestamp,signature:'xx',secret,now}),false));
test('short secret is rejected',()=>assert.equal(verifyBridgeSignature({raw,timestamp,signature,secret:'1234',now}),false));
test('stream size cap is enforced without content-length',async()=>{
 const request=new Request('https://audit.invalid',{method:'POST',body:'a'.repeat(100)});
 await assert.rejects(()=>readBridgeBody(request,50),/BODY_TOO_LARGE/);
});
test('within-size stream is preserved exactly',async()=>assert.equal(await readBridgeBody(new Request('https://audit.invalid',{method:'POST',body:raw})),raw));
