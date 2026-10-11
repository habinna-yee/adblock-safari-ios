import test from 'node:test';
import assert from 'node:assert/strict';
let listener,stored={},rules=[],enabled=['easylist','easyprivacy'],failStorage=false,failStatic=false,failTabs=false;
const noop={addListener(){}};
globalThis.browser={runtime:{getURL:p=>`safari-web-extension://harbor/${p}`,onMessage:{addListener:fn=>listener=fn},onInstalled:noop,onStartup:noop},storage:{local:{async get(key){return {[key]:structuredClone(stored[key])};},async set(next){if(failStorage){failStorage=false;throw Error('Disk full');}Object.assign(stored,structuredClone(next));}}},declarativeNetRequest:{async getDynamicRules(){return structuredClone(rules);},async updateDynamicRules({addRules}){rules=structuredClone(addRules);},async updateEnabledRulesets({enableRulesetIds}){if(failStatic){failStatic=false;throw Error('Rules unavailable');}enabled=[...enableRulesetIds];}},tabs:{async query(){if(failTabs)throw Error('Tab closed');return [];},async sendMessage(){}}};
globalThis.fetch=async path=>({ok:true,json:async()=>String(path).includes('-cosmetic')?[]:{lists:{}}});
const {DEFAULT,dynamicRules}=await import('../Extension/background.js');
const ui={url:'safari-web-extension://harbor/options.html'};
async function get(){return (await listener({type:'get'},ui)).data.settings;}
async function save(settings){return listener({type:'save',settings,revision:settings.revision},ui);}
test('settings transaction, revision, rollback and permission boundary',async t=>{
 await t.test('initializes bundled lists and default state',async()=>{const s=await get();assert.equal(s.enabled,true);assert.deepEqual(enabled,['easylist','easyprivacy']);});
 await t.test('allowlist create/read/delete persists and installs site exceptions',async()=>{let s=await get();let result=await save({...s,allowlist:['example.com']});assert.equal(result.ok,true);assert.equal(rules.filter(r=>r.priority===1000).length,2);s=await get();assert.deepEqual(s.allowlist,['example.com']);result=await save({...s,allowlist:[]});assert.equal(result.ok,true);assert.equal(rules.length,0);});
 await t.test('custom rule edits and removal update the actual dynamic set',async()=>{let s=await get();assert.equal((await save({...s,custom:'||ad.example^'})).ok,true);assert.equal(rules[0].action.type,'block');s=await get();assert.equal((await save({...s,custom:'@@||ad.example^'})).ok,true);assert.equal(rules[0].action.type,'allow');s=await get();await save({...s,custom:''});assert.equal(rules.length,0);});
 await t.test('stale editor fails without overwriting new settings',async()=>{const old=await get();await save({...old,enabled:false});const result=await save({...old,custom:'||lost.example^'});assert.equal(result.ok,false);assert.match(result.error,/another window/);assert.equal((await get()).custom,'');assert.ok(rules.find(r=>r.id===1));});
 await t.test('storage failure rolls back both dynamic rules and enabled lists',async()=>{const before=await get();const oldRules=structuredClone(rules);failStorage=true;const result=await save({...before,enabled:true,lists:{easylist:false,easyprivacy:false}});assert.equal(result.ok,false);assert.deepEqual(rules,oldRules);assert.deepEqual(enabled,['easylist','easyprivacy']);assert.deepEqual(await get(),before);});
 await t.test('partial Safari failure restores the committed configuration',async()=>{const before=await get();const oldRules=structuredClone(rules);failStatic=true;assert.equal((await save({...before,custom:'||new.example^'})).ok,false);assert.deepEqual(rules,oldRules);assert.deepEqual(await get(),before);});
 await t.test('invalid filters preserve prior persisted data',async()=>{const before=await get();assert.equal((await save({...before,custom:'||x.example^$redirect=noop'})).ok,false);assert.deepEqual(await get(),before);});
 await t.test('closed tabs do not misreport a successful save',async()=>{const before=await get();failTabs=true;assert.equal((await save({...before,enabled:true})).ok,true);failTabs=false;assert.equal((await get()).enabled,true);});
 await t.test('cookie automation obeys global, per-site and independent pause',async()=>{
  const sender={url:'https://news.example/article',tab:{url:'https://news.example/article'},frameId:0};
  const config=async()=> (await listener({type:'pageConfig'},sender)).data;
  let s=await get();assert.equal((await config()).consent,true);
  await save({...s,consent:false});assert.equal((await config()).consent,false);assert.equal((await config()).enabled,true);
  s=await get();await save({...s,consent:true,enabled:false});assert.equal((await config()).consent,false);
  s=await get();await save({...s,enabled:true,allowlist:['news.example']});assert.equal((await config()).consent,false);
  s=await get();await save({...s,allowlist:[],cosmetic:false});assert.equal((await config()).consent,true);assert.deepEqual((await config()).selectors,[]);
  s=await get();await save({...s,cosmetic:true});
 });
 await t.test('content scripts cannot rewrite settings or spoof picker hostname',async()=>{const settings=await get();assert.equal((await listener({type:'save',settings,revision:settings.revision},{url:'https://evil.example',tab:{url:'https://evil.example'},frameId:0})).ok,false);assert.equal((await listener({type:'addPicked',selector:'.ad'},{url:'https://evil.example',tab:{url:'https://news.example'},frameId:0})).ok,false);});
 await t.test('picker writes only a scoped CSS rule on the sender site',async()=>{assert.equal((await listener({type:'addPicked',selector:'.sponsor'},{url:'https://news.example/article',tab:{url:'https://news.example/article'},frameId:0})).ok,true);assert.match((await get()).custom,/news.example##\.sponsor/);});
});
test('rule IDs remain distinct at maximum allowlist size',()=>{const s={...DEFAULT,allowlist:Array.from({length:200},(_,i)=>`site${i}.example`),custom:'||ad.example^'};const rules=dynamicRules(s);assert.equal(new Set(rules.map(r=>r.id)).size,rules.length);});
