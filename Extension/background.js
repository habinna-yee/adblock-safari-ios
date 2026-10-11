import {compile, normalizeHost, matchesHost, selectorsFor, safeSelector} from './compiler.js';
const api = globalThis.browser ?? globalThis.chrome;
const LISTS = ['easylist','adguard-base','adguard-mobile','easyprivacy'];
export const DEFAULT = {schema:1,revision:0,enabled:true,lists:Object.fromEntries(LISTS.map(id=>[id,true])),cosmetic:true,consent:true,allowlist:[],custom:''};
let queue = Promise.resolve(), ready = false;
const cache = new Map();
async function asset(path) {
  if (!cache.has(path)) cache.set(path, fetch(api.runtime.getURL(path)).then(r=>{if(!r.ok) throw Error('Bundled filters could not be loaded. Reinstall Harbor.'); return r.json();}).catch(e=>{cache.delete(path);throw e;}));
  return cache.get(path);
}
async function read() { return (await api.storage.local.get('settings')).settings ?? structuredClone(DEFAULT); }
function validate(value) {
  if (!value || typeof value.enabled !== 'boolean' || typeof value.cosmetic !== 'boolean' || typeof value.lists !== 'object' || !value.lists || !LISTS.every(id=>[undefined,true,false].includes(value.lists[id]))) throw Error('Invalid settings. Reload and try again.');
  if (!Array.isArray(value.allowlist) || value.allowlist.length > 200) throw Error('Use no more than 200 allowed sites.');
  if (typeof value.custom !== 'string' || value.custom.length > 200000) throw Error('Custom filters must be under 200,000 characters.');
  return {schema:1,revision:Number.isInteger(value.revision)?value.revision:0,enabled:value.enabled,cosmetic:value.cosmetic,consent:value.consent !== false,lists:Object.fromEntries(LISTS.map(id=>[id,value.lists[id] ?? DEFAULT.lists[id]])),allowlist:[...new Set(value.allowlist.map(normalizeHost))].sort(),custom:value.custom};
}
export function dynamicRules(settings) {
  const rules = compile(settings.custom,{strict:true,startID:1000}).network;
  for (const rule of rules) rule.priority += 20;
  if (!settings.enabled) rules.push({id:1,priority:1000,action:{type:'allow'},condition:{urlFilter:'*'}});
  settings.allowlist.forEach((host,i)=>{
    rules.push({id:10+i*2,priority:1000,action:{type:'allowAllRequests'},condition:{urlFilter:`||${host}^`,resourceTypes:['main_frame']}});
    rules.push({id:11+i*2,priority:1000,action:{type:'allow'},condition:{domains:[host]}});
  });
  if (rules.length > 4500) throw Error('Too many custom network filters. Use fewer than 4,100 plus your allowed sites.');
  return rules;
}
async function apply(settings) {
  const rules = dynamicRules(settings);
  const old = await api.declarativeNetRequest.getDynamicRules();
  await api.declarativeNetRequest.updateDynamicRules({removeRuleIds:old.map(r=>r.id),addRules:rules});
  await api.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds:LISTS.filter(id=>settings.lists[id]),disableRulesetIds:LISTS.filter(id=>!settings.lists[id])});
}
async function initialize() {
  if (ready) return;
  // The committed settings are authoritative. A stopped background can recover any interrupted save.
  const stored = (await api.storage.local.get('settings')).settings;
  const settings = validate(stored ?? structuredClone(DEFAULT));
  await apply(settings);
  // Lists added by an update start enabled; store them so every editor sees the same settings.
  if (JSON.stringify(stored) !== JSON.stringify(settings)) await api.storage.local.set({settings});
  ready = true;
}
async function save(next, expected) {
  const before = await read();
  if (expected !== before.revision) throw Error('Settings changed in another window. Reload this page before saving. Your draft is still here.');
  next = validate(next); next.revision = before.revision + 1;
  try {
    await apply(next);
    await api.storage.local.set({settings:next});
  } catch (error) {
    ready = false;
    try {await apply(before);} catch {throw Error('Safari could not restore the previous rules. Close and reopen Harbor controls, then retry.');}
    throw Error(`Changes were not saved: ${error.message}`);
  }
  try {
    const tabs = await api.tabs.query({});
    await Promise.allSettled(tabs.map(tab=>api.tabs.sendMessage(tab.id,{type:'refresh'})));
  } catch { /* Saving succeeded; a closed or inaccessible tab must not turn it into a failure. */ }
  return next;
}
function pageHost(url) { try {const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname : null;} catch {return null;} }
async function dispatch(message,sender) {
  await initialize();
  const settings = await read();
  const trustedUI = sender.url?.startsWith(api.runtime.getURL('')) && !sender.tab?.url?.startsWith('http');
  if (message.type === 'pageConfig') {
    const host = pageHost(sender.url), top = pageHost(sender.tab?.url) ?? host;
    if (!host || !top) return {enabled:false,consent:false,selectors:[]};
    const enabled = settings.enabled && !settings.allowlist.some(d=>matchesHost(top,d));
    if (!enabled || !settings.cosmetic) return {enabled,consent:enabled&&settings.consent,selectors:[]};
    // Precedence matches the network rules: your filters, then EasyList and EasyPrivacy, then lists that supplement them.
    const report = await asset('rules/report.json'), on = LISTS.filter(id=>settings.lists[id]);
    const tier = ids => Promise.all(ids.map(id=>asset(`rules/${id}-cosmetic.json`))).then(sets=>sets.flat());
    const [lists,supplements] = await Promise.all([tier(on.filter(id=>!report.lists[id]?.supplements)),tier(on.filter(id=>report.lists[id]?.supplements))]);
    return {enabled,consent:enabled&&settings.consent,selectors:selectorsFor(host,compile(settings.custom).cosmetic,lists,supplements)};
  }
  if (message.type === 'addPicked') {
    if (sender.frameId !== 0 || !pageHost(sender.tab?.url) || pageHost(sender.url) !== pageHost(sender.tab.url)) throw Error('Open the picker on a normal website.');
    const host = pageHost(sender.url), selector = message.selector;
    if (!safeSelector(selector)) throw Error('This element cannot be saved as a filter.');
    if (!settings.enabled || !settings.cosmetic || settings.allowlist.some(d=>matchesHost(host,d))) throw Error('Enable protection and element hiding for this site first.');
    const line = `${host}##${selector}`;
    return save({...settings,custom:[settings.custom,line].filter(Boolean).join('\n')},settings.revision);
  }
  if (!trustedUI) throw Error('This action is only available from Harbor controls.');
  if (message.type === 'get') return {settings,report:await asset('rules/report.json')};
  if (message.type === 'save') return {settings:await save(message.settings,message.revision)};
  throw Error('Unknown action.');
}
api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  const task = queue.then(()=>dispatch(message,sender));
  queue = task.catch(()=>{});
  const reply = task.then(data=>({ok:true,data}),error=>({ok:false,error:error.message}));
  // Chromium (tested on 141) ignores a returned Promise, so answer through sendResponse and keep the channel open.
  if (typeof sendResponse !== 'function') return reply;
  reply.then(sendResponse);
  return true;
});
function wake() {const task=queue.then(initialize); queue=task.catch(()=>{ready=false;});}
api.runtime.onInstalled.addListener(wake);
api.runtime.onStartup.addListener(wake);
