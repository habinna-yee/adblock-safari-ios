import {send,$,status,busy,validateCSS} from './ui.js';
import {normalizeHost,compile} from './compiler.js';
let settings,report,dirty=false,saving=false;
function route(){const name=['protection','filters','setup'].includes(location.hash.slice(1))?location.hash.slice(1):'protection';for(const id of ['protection','filters','setup'])$(id).hidden=id!==name;document.querySelectorAll('nav a').forEach(a=>{if(a.hash===`#${name}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.title=`Harbor — ${name==='filters'?'My filters':name==='setup'?'Setup':'Protection'}`;}
window.addEventListener('hashchange',route);route();
function render(){
  for(const id of ['enabled','cosmetic','consent']){$(id).checked=settings[id];$(id).disabled=false;}
  for(const id of ['easylist','easyprivacy']){$(id).checked=settings.lists[id];$(id).disabled=false;const entry=report.lists[id];$(id+'-count').textContent=`${entry.networkFilters.toLocaleString()} supported network filters · ${entry.skipped.toLocaleString()} skipped`;}
  $('network-count').textContent=Object.values(report.lists).reduce((a,l)=>a+l.compiledRules,0).toLocaleString();
  $('cosmetic-count').textContent=Object.values(report.lists).reduce((a,l)=>a+l.cosmeticFilters,0).toLocaleString();
  $('version').textContent=`Bundled ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(report.builtAt))}. These are rule counts, not blocked-request statistics.`;
  $('sites').replaceChildren();
  for(const host of settings.allowlist){const li=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');label.textContent=host;button.textContent='Remove';button.setAttribute('aria-label',`Remove exception for ${host}`);button.onclick=()=>commit({...settings,allowlist:settings.allowlist.filter(d=>d!==host)},'Exception removed. Reload the website.').then(ok=>{if(ok)$('domain').focus();});li.append(label,button);$('sites').append(li);}
  $('empty-sites').hidden=settings.allowlist.length>0;
  if(!dirty)$('custom').value=settings.custom;
  for(const id of ['custom','save-custom','discard','add-site'])$(id).disabled=false;
}
async function commit(next,message){if(saving)return false;saving=true;busy(true);let success=false;try{settings=(await send({type:'save',settings:next,revision:settings.revision})).settings;status(message);success=true;}catch(e){status(e.message,true);}finally{saving=false;busy(false);render();}return success;}
for(const id of ['enabled','cosmetic','consent'])$(id).onchange=()=>commit({...settings,[id]:$(id).checked},'Saved. Reload open websites to apply all changes.');
for(const id of ['easylist','easyprivacy'])$(id).onchange=()=>commit({...settings,lists:{...settings.lists,[id]:$(id).checked}},'Filter list preference saved. Reload open websites.');
$('allow-form').onsubmit=async event=>{event.preventDefault();$('domain-error').textContent='';$('domain').removeAttribute('aria-invalid');try{const host=normalizeHost($('domain').value);if(settings.allowlist.includes(host))throw Error('This website is already allowed.');if(await commit({...settings,allowlist:[...settings.allowlist,host]},'Website allowed. Reload it in Safari.'))$('domain').value='';}catch(e){$('domain-error').textContent=e.message;$('domain').setAttribute('aria-invalid','true');$('domain').focus();}};
$('custom').oninput=()=>{dirty=$('custom').value!==settings.custom;};
$('custom-form').onsubmit=async event=>{event.preventDefault();$('custom-error').textContent='';$('custom').removeAttribute('aria-invalid');try{const custom=$('custom').value;compile(custom,{strict:true});validateCSS(custom);if(await commit({...settings,custom},'Filters saved. Reload open websites.')){dirty=false;render();}}catch(e){$('custom-error').textContent=e.message;$('custom').setAttribute('aria-invalid','true');$('custom').focus();}};
$('discard').onclick=()=>{dirty=false;$('custom-error').textContent='';$('custom').removeAttribute('aria-invalid');render();status('Unsaved edits discarded.');};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
async function load(){busy(true);try{({settings,report}=await send({type:'get'}));$('retry').hidden=true;status('Settings loaded.');}catch(e){status(e.message,true);$('retry').hidden=false;}finally{busy(false);if(settings)render();}}
$('retry').disabled=false;$('retry').onclick=load;void load();
