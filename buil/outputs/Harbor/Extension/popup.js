import {api,send,$,status,busy} from './ui.js';
import {matchesHost} from './compiler.js';
let settings,tab,host;
$('settings').disabled=false;
function render(){
  const allowed=settings.allowlist.find(d=>matchesHost(host??'',d));
  $('enabled').checked=settings.enabled;$('enabled').disabled=false;
  $('site').checked=!!host&&!allowed;$('site').disabled=!host||!settings.enabled;
  $('picker').disabled=!host||!settings.enabled||!!allowed||!settings.cosmetic;
  $('reload').disabled=!host;
  $('protection').textContent=!host?'Open a website in Safari':!settings.enabled?'Protection paused':allowed?'Paused on this site':'Blocking is configured';
  $('hint').textContent=allowed&&allowed!==host?`Paused by your ${allowed} exception. Enabling here removes that exception.`:'Changes apply to new requests. Reload to refresh this page. Safari must allow Harbor on this website.';
}
async function commit(next){busy(true);try{settings=(await send({type:'save',settings:next,revision:settings.revision})).settings;status('Saved. Reload the page to apply all changes.');}catch(e){status(e.message,true);}finally{busy(false);render();}}
$('enabled').addEventListener('change',()=>commit({...settings,enabled:$('enabled').checked}));
$('site').addEventListener('change',()=>commit({...settings,allowlist:$('site').checked?settings.allowlist.filter(d=>!matchesHost(host,d)):[...settings.allowlist,host]}));
$('settings').onclick=()=>api.runtime.openOptionsPage().catch(e=>status(e.message,true));
$('reload').onclick=()=>api.tabs.reload(tab.id).then(()=>window.close()).catch(e=>status(e.message,true));
$('picker').onclick=async()=>{try{await api.tabs.sendMessage(tab.id,{type:'pick'},{frameId:0});window.close();}catch{status('Allow Harbor access to this website in Safari, reload, then try again.',true);}};
try{
  settings=(await send({type:'get'})).settings;
  [tab]=await api.tabs.query({active:true,currentWindow:true});
  try{const url=new URL(tab?.url);if(/^https?:$/.test(url.protocol))host=url.hostname;}catch{}
  $('host').textContent=host??'No website selected';render();
  $('cookie-status').textContent=settings.consent?'Cookie choices: necessary + functional only':'Automatic cookie choices are off';
  if(host&&settings.consent){try{const state=await api.tabs.sendMessage(tab.id,{type:'pageStatus'},{frameId:0});$('cookie-status').textContent=state.consent;}catch{}}
}catch(e){status(e.message,true);$('host').textContent='Could not load controls';}
