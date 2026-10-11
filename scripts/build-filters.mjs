import fs from 'node:fs/promises';
import {LISTS,buildLists} from './lists.mjs';
const root = new URL('../',import.meta.url);
const texts = Object.fromEntries(await Promise.all(LISTS.map(async list => [list.id,await fs.readFile(new URL(`vendor/${list.id}.txt`,root),'utf8')])));
const {files,report} = buildLists(texts);
for (const [path,content] of Object.entries(files)) await fs.writeFile(new URL(path,root),content);
console.log(JSON.stringify(report,null,2));
