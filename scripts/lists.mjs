// Bundled filter lists and the build shared by build-filters.mjs, update-filters.mjs and check.mjs.
import {createHash} from 'node:crypto';
import {compile,compactRules} from '../Extension/compiler.js';
// A list that supplements another drops rules the other already has and ranks below it,
// so enabling it can add blocking but never unblock what the other list blocks.
export const LISTS = [
  {id:'easylist',name:'EasyList',source:'https://easylist.to/easylist/easylist.txt',minimum:1000},
  {id:'easyprivacy',name:'EasyPrivacy',source:'https://easylist.to/easylist/easyprivacy.txt',minimum:1000},
  {id:'adguard-base',name:'AdGuard Base',source:'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/platforms/extension/safari/filters/2.txt',supplements:'easylist',minimum:1000},
  {id:'adguard-mobile',name:'AdGuard Mobile Ads',source:'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/platforms/extension/safari/filters/11.txt',supplements:'easylist',minimum:100},
];
// Safari compiles every enabled rule into one WebKit content-blocker list and rejects the whole list,
// blocking nothing, above 150,000 translated rules (WebCore ContentExtensionParser.cpp). Each
// requestDomains entry becomes its own translated rule (_WKWebExtensionDeclarativeNetRequestRule.mm).
export const SAFARI_RULE_LIMIT = 150000;
export const DYNAMIC_RULE_LIMIT = 4500; // background.js dynamicRules() maximum
export const CHROMIUM_STATIC_LIMIT = 30000; // GUARANTEED_MINIMUM_STATIC_RULES, for tests/browser.mjs
export const safariRuleCount = rules => rules.reduce((n,r)=>n+(r.condition.requestDomains?.length ?? 1)+(r.condition.excludedRequestDomains?.length ?? 0),0);
const networkKey = r => JSON.stringify([r.action.type,r.condition]);
const cosmeticKey = r => JSON.stringify([r.included,r.excluded,r.selector,r.exception,r.disable ?? null]);
// texts: {id: list source text}. Returns the files to write and the report; throws if Safari would reject the rules.
export function buildLists(texts, builtAt = new Date().toISOString()) {
  const report = {builtAt,lists:{}}, files = {}, parsed = {};
  let compiled = 0, safari = 0;
  for (const list of LISTS) {
    const text = texts[list.id], result = compile(text);
    parsed[list.id] = result;
    let {network,cosmetic} = result, duplicates = 0;
    if (list.supplements) {
      const base = parsed[list.supplements], seen = new Set(base.network.map(networkKey)), seenCosmetic = new Set(base.cosmetic.map(cosmeticKey));
      const total = network.length + cosmetic.length;
      network = network.filter(r => !seen.has(networkKey(r))).map(r => ({...r,priority:r.action.type === 'allow' ? 5 : 1}));
      cosmetic = cosmetic.filter(r => !seenCosmetic.has(cosmeticKey(r)));
      duplicates = total - network.length - cosmetic.length;
    }
    const rules = compactRules(network), count = safariRuleCount(rules);
    compiled += rules.length; safari += count;
    files[`Extension/rules/${list.id}.json`] = JSON.stringify(rules);
    files[`Extension/rules/${list.id}-cosmetic.json`] = JSON.stringify(cosmetic);
    files[`vendor/${list.id}-skipped.json`] = JSON.stringify(result.rejected,null,2);
    report.lists[list.id] = {name:list.name,source:list.source,sha256:createHash('sha256').update(text).digest('hex'),version:text.match(/^! Version: (.+?)\r?$/m)?.[1],...(list.supplements ? {supplements:list.supplements,duplicatesRemoved:duplicates} : {}),networkFilters:network.length,compiledRules:rules.length,safariRules:count,cosmeticFilters:cosmetic.length,skipped:result.rejected.length};
  }
  if (compiled > CHROMIUM_STATIC_LIMIT) throw Error(`Static rule budget exceeded: ${compiled} rules; do not ship.`);
  if (safari + DYNAMIC_RULE_LIMIT > SAFARI_RULE_LIMIT) throw Error(`Safari would reject every rule: ${safari} translated static rules plus ${DYNAMIC_RULE_LIMIT} dynamic exceed ${SAFARI_RULE_LIMIT}; do not ship.`);
  report.totals = {compiledRules:compiled,safariRules:safari,safariLimit:SAFARI_RULE_LIMIT,dynamicReserve:DYNAMIC_RULE_LIMIT};
  files['Extension/rules/report.json'] = JSON.stringify(report,null,2);
  return {files,report};
}
