import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compile,compactRules} from '../Extension/compiler.js';
const root = new URL('../',import.meta.url);
const report = {builtAt:new Date().toISOString(),lists:{}};
let total=0;
for (const id of ['easylist','easyprivacy']) {
  const source = await fs.readFile(new URL(`vendor/${id}.txt`,root),'utf8');
  const parsed = compile(source);
  const rules = compactRules(parsed.network);
  total+=rules.length;
  await fs.writeFile(new URL(`Extension/rules/${id}.json`,root),JSON.stringify(rules));
  await fs.writeFile(new URL(`Extension/rules/${id}-cosmetic.json`,root),JSON.stringify(parsed.cosmetic));
  report.lists[id] = {source:`https://easylist.to/easylist/${id}.txt`,sha256:createHash('sha256').update(source).digest('hex'),version:source.match(/^! Version: (.+)$/m)?.[1],networkFilters:parsed.network.length,compiledRules:rules.length,cosmeticFilters:parsed.cosmetic.length,skipped:parsed.rejected.length};
  await fs.writeFile(new URL(`vendor/${id}-skipped.json`,root),JSON.stringify(parsed.rejected,null,2));
}
if(total>30000) throw Error(`Static budget exceeded: ${total}; do not ship.`);
await fs.writeFile(new URL('Extension/rules/report.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
