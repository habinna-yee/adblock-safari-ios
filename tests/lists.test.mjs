import test from 'node:test';
import assert from 'node:assert/strict';
import {LISTS,buildLists,safariRuleCount} from '../scripts/lists.mjs';
const texts=lines=>Object.fromEntries(LISTS.map(l=>[l.id,`! Title: ${l.name}\n${lines[l.id]??''}`]));
const json=(files,path)=>JSON.parse(files[path]);
test('supplementary lists drop EasyList duplicates and rank below EasyList',()=>{
 const {files,report}=buildLists(texts({easylist:'||a.example^\n##.ad',['adguard-base']:'||a.example^\r\n||b.example^\r\n@@||amazon.example^$domain=news.example\r\n##.ad\r\n##.extra'}));
 const rules=json(files,'Extension/rules/adguard-base.json');
 assert.deepEqual(rules.flatMap(r=>r.condition.requestDomains).sort(),['amazon.example','b.example']);
 assert.ok(rules.every(r=>r.priority<json(files,'Extension/rules/easylist.json')[0].priority));
 assert.equal(rules.find(r=>r.action.type==='allow').priority,5);
 assert.deepEqual(json(files,'Extension/rules/adguard-base-cosmetic.json').map(r=>r.selector),['.extra']);
 assert.equal(report.lists['adguard-base'].duplicatesRemoved,2);
});
test('Safari rule count expands grouped domains, and the build refuses lists Safari would reject',()=>{
 assert.equal(safariRuleCount([{condition:{requestDomains:['a.example','b.example']}},{condition:{urlFilter:'||c.example/ad'}}]),3);
 const domains=Array.from({length:146000},(_,i)=>`||d${i}.example^`).join('\n');
 assert.throws(()=>buildLists(texts({easyprivacy:domains})),/Safari would reject every rule/);
});
