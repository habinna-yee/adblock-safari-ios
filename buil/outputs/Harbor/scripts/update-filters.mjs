// Fetch only trusted text filter sources. No downloaded JavaScript is ever executed.
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {compile,compactRules} from '../Extension/compiler.js';
const root=new URL('../',import.meta.url);const downloads=[];
for(const id of ['easylist','easyprivacy']){
 const response=await fetch(`https://easylist.to/easylist/${id}.txt`,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Could not download ${id}: ${response.status}`);
 const text=await response.text();if(text.length>10000000||!text.startsWith('[Adblock'))throw Error(`Unexpected ${id} file.`);
 const parsed=compile(text);if(parsed.network.length<1000)throw Error(`Suspiciously small ${id}; retaining old lists.`);
 downloads.push({id,text,count:compactRules(parsed.network).length});
}
if(downloads.reduce((n,d)=>n+d.count,0)>30000)throw Error('Updated lists exceed the static rule budget. Old lists retained.');
for(const {id,text} of downloads)await fs.writeFile(new URL(`vendor/${id}.txt`,root),text);
const result=spawnSync(process.execPath,[new URL('scripts/build-filters.mjs',root).pathname],{stdio:'inherit'});process.exitCode=result.status??1;
