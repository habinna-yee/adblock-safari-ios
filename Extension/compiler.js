/* Conservative ABP subset. Unsupported semantics are rejected, never broadened. */
export const TYPES = ['sub_frame','stylesheet','script','image','font','xmlhttprequest','ping','media','websocket','other'];
const TYPE_MAP = {subdocument:'sub_frame',document:'main_frame',stylesheet:'stylesheet',script:'script',image:'image',font:'font',xmlhttprequest:'xmlhttprequest',ping:'ping',media:'media',websocket:'websocket',other:'other'};
// Element-hiding exceptions: which cosmetic filters they turn off on a site.
const HIDE_OPTIONS = new Map(Object.entries({generichide:'generic',ghide:'generic',specifichide:'specific',shide:'specific',elemhide:'all',ehide:'all'}));
export function normalizeHost(value) {
  const input = value.trim().toLowerCase().replace(/\.$/, '');
  if (!input || /[\s/@:*?#\\]/.test(input)) throw Error('Enter a hostname, such as example.com, without a URL or path.');
  const host = new URL(`https://${input}`).hostname;
  if (host.length > 253 || !host.split('.').every(p => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p))) throw Error('Enter a valid hostname.');
  return host;
}
export function matchesHost(host, ruleHost) { return host === ruleHost || host.endsWith(`.${ruleHost}`); }
function domains(raw, separator) {
  const included = [], excluded = [];
  for (const part of raw.split(separator)) {
    if (!part) throw Error('Empty domain in filter.');
    const negative = part.startsWith('~');
    (negative ? excluded : included).push(normalizeHost(negative ? part.slice(1) : part));
  }
  return {included, excluded};
}
export function safeSelector(selector) {
  return !!selector && selector.length <= 2000 && !/[{}\x00-\x1f]/.test(selector) && !/:(?:-abp-|contains\(|has-text\(|matches-|xpath\(|remove\(|style\()/i.test(selector) && !selector.includes('##');
}
export function parseLine(line, id = 1) {
  line = line.trim();
  if (!line || line.startsWith('!') || line.startsWith('[')) return {kind:'comment'};
  if (/#@?(?:\$\??|%|\?)#/.test(line)) throw Error('Procedural and script filters are not supported.');
  const cosmetic = line.match(/^(.*?)#(@?)#(.+)$/);
  if (cosmetic) {
    const [,scope,exception,selector] = cosmetic;
    if (!safeSelector(selector) || selector.startsWith('+js(')) throw Error('Use a standard CSS selector. Scriptlets and procedural filters are not supported.');
    const {included,excluded} = scope ? domains(scope, ',') : {included:[], excluded:[]};
    return {kind:'cosmetic', rule:{included,excluded,selector,exception:!!exception}};
  }
  const allow = line.startsWith('@@');
  let body = allow ? line.slice(2) : line;
  const dollar = body.lastIndexOf('$');
  const options = dollar < 0 ? [] : body.slice(dollar+1).split(',');
  if (dollar >= 0) body = body.slice(0,dollar);
  if (allow && options.some(o => HIDE_OPTIONS.has(o))) return hideException(body, options);
  if (!body || body.length > 1800 || /[^\x20-\x7e]/.test(body) || /\s/.test(body) || body.startsWith('/') && body.endsWith('/')) throw Error('Use an ASCII URL pattern; regular-expression filters are not supported.');
  if (body.startsWith('||*')) throw Error('Start with || and a domain, such as ||example.com^, not ||*.');
  const condition = {urlFilter:body};
  let includedTypes = [], excludedTypes = [];
  for (const option of options) {
    const negative = option.startsWith('~');
    const name = negative ? option.slice(1) : option;
    if (TYPE_MAP[name]) (negative ? excludedTypes : includedTypes).push(TYPE_MAP[name]);
    else if (name === 'third-party' || name === '3p') condition.domainType = negative ? 'firstParty' : 'thirdParty';
    else if (option === 'match-case') condition.isUrlFilterCaseSensitive = true;
    else if (option === 'all') includedTypes.push(...TYPES);
    else if (option.startsWith('domain=')) {
      const {included,excluded} = domains(option.slice(7),'|');
      if (included.length) condition.domains = included;
      if (excluded.length) condition.excludedDomains = excluded;
    } else throw Error(`Unsupported option: ${option}.`);
  }
  if (includedTypes.includes('main_frame')) throw Error('Document filters are not supported; use the site allowlist.');
  // Safari keeps only the included sites when a rule lists both, which would broaden it.
  if (condition.domains && condition.excludedDomains) throw Error('Safari cannot combine included and excluded sites in one network filter. Use separate filters.');
  const types = (includedTypes.length ? includedTypes : TYPES).filter(t => !excludedTypes.includes(t));
  if (!types.length) throw Error('Filter has no resource types.');
  condition.resourceTypes = [...new Set(types)];
  return {kind:'network',rule:{id,priority:allow ? 20 : 10,action:{type:allow ? 'allow' : 'block'},condition}};
}
// @@||example.com^$generichide, or @@$generichide,domain=example.com, as a cosmetic rule that turns filters off.
function hideException(body, options) {
  const scope = options.find(o => o.startsWith('domain='));
  const other = options.find(o => !HIDE_OPTIONS.has(o) && o !== scope);
  if (other) throw Error(`Unsupported option: ${other}.`);
  const host = body.match(/^\|\|([a-z0-9.-]+)\^?$/i)?.[1];
  const named = host ? !scope : !!scope && ['','*'].includes(body);
  const {included,excluded} = !named ? {included:[]} : host ? {included:[normalizeHost(host)],excluded:[]} : domains(scope.slice(7),'|');
  if (!included.length) throw Error('Element-hiding exceptions must name a site, such as @@||example.com^$generichide.');
  const kinds = new Set(options.map(o => HIDE_OPTIONS.get(o)).filter(Boolean));
  const disable = kinds.has('all') || kinds.size > 1 ? 'all' : [...kinds][0];
  return {kind:'cosmetic', rule:{included,excluded,selector:'',exception:true,disable}};
}
export function compile(text, {strict = false, startID = 1} = {}) {
  const lines = text.split(/\r?\n/), network = [], cosmetic = [], rejected = [];
  // A badfilter cancels its corresponding rule; never keep a rule whose cancellation was skipped.
  const disabled = new Set(lines.filter(l => /\$.*(?:^|,)badfilter(?:,|$)/.test(l) || l.endsWith('$badfilter')).map(l => l.trim().replace(/,badfilter\b|badfilter,|\$badfilter$/, '')));
  for (let i=0; i<lines.length; i++) {
    if (disabled.has(lines[i].trim())) continue;
    try {
      const parsed = parseLine(lines[i], startID + network.length);
      if (parsed.kind === 'network') network.push(parsed.rule);
      if (parsed.kind === 'cosmetic') cosmetic.push(parsed.rule);
    } catch (error) { rejected.push({line:i+1,reason:error.message}); }
  }
  if (strict && rejected.length) throw Error(`Line ${rejected[0].line}: ${rejected[0].reason}`);
  return {network,cosmetic,rejected};
}
export function selectorsFor(host, rules) {
  const applicable = rules.filter(r => (!r.included.length || r.included.some(d=>matchesHost(host,d))) && !r.excluded.some(d=>matchesHost(host,d)));
  const off = new Set(applicable.filter(r=>r.disable).map(r=>r.disable));
  if (off.has('all')) return [];
  const exceptions = new Set(applicable.filter(r=>r.exception && !r.disable).map(r=>r.selector));
  // Filters scoped only by excluded sites are generic, as in Adblock Plus.
  return [...new Set(applicable.filter(r=>!r.exception && !exceptions.has(r.selector) && !off.has(r.included.length ? 'specific' : 'generic')).map(r=>r.selector))];
}
// Collapse equivalent pure-domain rules to preserve coverage within static-rule budgets.
export function compactRules(rules) {
  const groups = new Map(), output = [];
  for (const rule of rules) {
    const match = rule.condition.urlFilter.match(/^\|\|([a-z0-9.-]+)\^$/);
    if (!match) { output.push(rule); continue; }
    const {urlFilter,...rest} = rule.condition;
    const key = JSON.stringify([rule.priority,rule.action,rest]);
    if (!groups.has(key)) groups.set(key,{...rule,condition:rest,domains:[]});
    groups.get(key).domains.push(match[1]);
  }
  for (const group of groups.values()) {
    const {domains,...rule} = group;
    const unique = [...new Set(domains)];
    for (let i=0;i<unique.length;i+=250) output.push({...rule,condition:{...rule.condition,requestDomains:unique.slice(i,i+250)}});
  }
  return output.map((rule,i)=>({...rule,id:i+1}));
}
