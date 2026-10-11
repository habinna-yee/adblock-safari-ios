export const api=globalThis.browser ?? globalThis.chrome;
export async function send(message){const result=await api.runtime.sendMessage(message);if(!result?.ok)throw Error(result?.error??'Harbor could not respond. Close and reopen these controls.');return result.data;}
export const $=id=>document.getElementById(id);
export function status(text,error=false){const node=$('status');node.textContent=text;node.dataset.error=String(error);node.setAttribute('role',error?'alert':'status');}
export function busy(value){document.querySelectorAll('button,input,textarea').forEach(el=>{if(value){el.dataset.wasDisabled=String(el.disabled);el.disabled=true;}else el.disabled=el.dataset.wasDisabled==='true';});document.body.setAttribute('aria-busy',String(value));}
export function validateCSS(text){
  for(const [i,line] of text.split(/\r?\n/).entries()) {const match=line.trim().match(/^.*?#@?#(.+)$/);if(match&&!CSS.supports(`selector(${match[1]})`))throw Error(`Line ${i+1}: Safari does not support this CSS selector.`);}
}
