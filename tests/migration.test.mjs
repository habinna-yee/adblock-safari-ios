import test from 'node:test';
import assert from 'node:assert/strict';
// Settings committed by a version that only bundled EasyList and EasyPrivacy.
let listener,enabled=[],stored={settings:{schema:1,revision:3,enabled:true,lists:{easylist:true,easyprivacy:false},cosmetic:true,consent:true,allowlist:['example.com'],custom:'||ad.example^'}};
const noop={addListener(){}};
globalThis.browser={runtime:{getURL:p=>`safari-web-extension://harbor/${p}`,onMessage:{addListener:fn=>listener=fn},onInstalled:noop,onStartup:noop},storage:{local:{async get(key){return {[key]:structuredClone(stored[key])};},async set(next){Object.assign(stored,structuredClone(next));}}},declarativeNetRequest:{async getDynamicRules(){return [];},async updateDynamicRules(){},async updateEnabledRulesets({enableRulesetIds}){enabled=[...enableRulesetIds];}},tabs:{async query(){return [];},async sendMessage(){}}};
globalThis.fetch=async()=>({ok:true,json:async()=>({lists:{}})});
await import('../Extension/background.js');
test('lists added by an update start enabled and keep earlier choices',async()=>{
 const {settings}=(await listener({type:'get'},{url:'safari-web-extension://harbor/options.html'})).data;
 assert.deepEqual(settings.lists,{easylist:true,'adguard-base':true,'adguard-mobile':true,easyprivacy:false});
 assert.deepEqual(enabled,['easylist','adguard-base','adguard-mobile']);
 assert.deepEqual(stored.settings,settings);
 assert.equal(settings.revision,3);assert.deepEqual(settings.allowlist,['example.com']);assert.equal(settings.custom,'||ad.example^');
});
