import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {LISTS,SAFARI_RULE_LIMIT,DYNAMIC_RULE_LIMIT,CHROMIUM_STATIC_LIMIT,safariRuleCount} from './lists.mjs';
const root=new URL('../',import.meta.url);const ext=new URL('Extension/',root);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',ext),'utf8'));
for(const path of ['popup.html','options.html',...Object.values(manifest.icons),...manifest.content_scripts.flatMap(x=>x.js)])await fs.access(new URL(path,ext));
for(const file of await fs.readdir(ext)){if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',new URL(file,ext).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}}
// Every bundled list is declared, toggleable and loaded by the background.
const resources=manifest.declarative_net_request.rule_resources;
assert.deepEqual(resources.map(r=>r.id).sort(),LISTS.map(l=>l.id).sort());
const [options,optionsJS,background]=await Promise.all(['options.html','options.js','background.js'].map(f=>fs.readFile(new URL(f,ext),'utf8')));
for(const {id} of LISTS){assert.ok(options.includes(`id="${id}"`),`options.html toggle for ${id}`);assert.ok(optionsJS.includes(`'${id}'`)&&background.includes(`'${id}'`),`list ${id} in options.js and background.js`);await fs.access(new URL(`rules/${id}-cosmetic.json`,ext));}
assert.ok(background.includes(`rules.length > ${DYNAMIC_RULE_LIMIT})`),'dynamic rule limit matches scripts/lists.mjs');
let count=0,safari=0;
for(const resource of resources){const rules=JSON.parse(await fs.readFile(new URL(resource.path,ext),'utf8'));const ids=new Set();const supplement=LISTS.find(l=>l.id===resource.id).supplements;for(const rule of rules){assert.ok(rule.id>0&&!ids.has(rule.id));ids.add(rule.id);assert.ok(['allow','block'].includes(rule.action.type));assert.ok(rule.condition.urlFilter||rule.condition.requestDomains?.length);assert.ok(rule.condition.resourceTypes?.length);assert.ok(!(rule.condition.domains&&rule.condition.excludedDomains));if(supplement)assert.ok(rule.priority<10,`${resource.id} rule ${rule.id} must rank below ${supplement}`);}count+=rules.length;safari+=safariRuleCount(rules);}
assert.ok(count<=CHROMIUM_STATIC_LIMIT);
assert.ok(safari+DYNAMIC_RULE_LIMIT<=SAFARI_RULE_LIMIT,`Safari would reject all rules: ${safari} static + ${DYNAMIC_RULE_LIMIT} dynamic`);
console.log(`Manifest, scripts and ${count.toLocaleString()} static rules checked (${safari.toLocaleString()} after Safari conversion; limit ${SAFARI_RULE_LIMIT.toLocaleString()} including ${DYNAMIC_RULE_LIMIT.toLocaleString()} reserved for custom rules).`);
