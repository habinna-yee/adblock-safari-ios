// Fetch only trusted text filter sources. No downloaded JavaScript is ever executed.
import fs from 'node:fs/promises';
import {compile} from '../Extension/compiler.js';
import {LISTS,buildLists} from './lists.mjs';
const root=new URL('../',import.meta.url);const texts={};
for(const list of LISTS){
 const response=await fetch(list.source,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Could not download ${list.id}: ${response.status}`);
 const text=await response.text();if(text.length>10000000||!/^! Title: /m.test(text.slice(0,2000)))throw Error(`Unexpected ${list.id} file.`);
 if(compile(text).network.length<list.minimum)throw Error(`Suspiciously small ${list.id}; retaining old lists.`);
 texts[list.id]=text;
}
// Builds in memory first: lists that would exceed a rule budget never replace the bundled ones.
const {files,report}=buildLists(texts);
for(const list of LISTS)await fs.writeFile(new URL(`vendor/${list.id}.txt`,root),texts[list.id]);
for(const [path,content] of Object.entries(files))await fs.writeFile(new URL(path,root),content);
console.log(JSON.stringify(report.totals,null,2));
