import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);const ext=new URL('Extension/',root);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',ext),'utf8'));
for(const path of ['popup.html','options.html',...Object.values(manifest.icons),...manifest.content_scripts.flatMap(x=>x.js)])await fs.access(new URL(path,ext));
for(const file of await fs.readdir(ext)){if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',new URL(file,ext).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}}
let count=0;
for(const resource of manifest.declarative_net_request.rule_resources){const rules=JSON.parse(await fs.readFile(new URL(resource.path,ext),'utf8'));const ids=new Set();for(const rule of rules){assert.ok(rule.id>0&&!ids.has(rule.id));ids.add(rule.id);assert.ok(['allow','block'].includes(rule.action.type));assert.ok(rule.condition.urlFilter||rule.condition.requestDomains?.length);assert.ok(rule.condition.resourceTypes?.length);}count+=rules.length;}
assert.ok(count<30000);console.log(`Manifest, scripts and ${count.toLocaleString()} static rules checked.`);
