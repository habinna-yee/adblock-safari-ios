(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  let sheetHost, generation=0, stopPicker, pickerInput;
  // While the picker runs, every tap lands on its cover. Listening here, from document_start and so normally before
  // page scripts, keeps picker input from page and ad listeners, which could otherwise open ads or popunders.
  if(window===window.top) for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','dblclick','auxclick','contextmenu']) window.addEventListener(type,event=>pickerInput?.(event),{capture:true,passive:true});
  async function refresh() {
    const current=++generation;
    try {
      const reply = await api.runtime.sendMessage({type:'pageConfig'});
      if(current!==generation) return;
      if(!reply?.ok) return;
      globalThis.HarborConsent?.configure(!!reply.data.consent);
      sheetHost?.remove(); sheetHost=null;
      if(!reply.data.enabled || !reply.data.selectors.length) return;
      const style=document.createElement('style');
      (document.head ?? document.documentElement).append(style); sheetHost=style;
      // Separate rules keep one unsupported site selector from invalidating other filters.
      for(const selector of reply.data.selectors) {
        try { if(CSS.supports(`selector(${selector})`)) style.sheet.insertRule(`${selector}{display:none!important}`,style.sheet.cssRules.length); } catch { /* unsupported standard CSS is safely ignored */ }
      }
    } catch { /* No DOM changes if Safari revokes access or unloads the extension. */ }
  }
  function selectorFor(element) {
    const pieces=[];
    for(let node=element;node && node!==document.documentElement;node=node.parentElement) {
      if(node.id) {pieces.unshift(`#${CSS.escape(node.id)}`);break;}
      let piece=node.localName;
      const classes=[...node.classList].filter(c=>c.length<80).slice(0,2);
      if(classes.length) piece+=classes.map(c=>`.${CSS.escape(c)}`).join('');
      const peers=node.parentElement ? [...node.parentElement.children].filter(n=>n.localName===node.localName) : [];
      if(peers.length>1) piece+=`:nth-of-type(${peers.indexOf(node)+1})`;
      pieces.unshift(piece);
      if(pieces.length>=8) break;
    }
    return pieces.join(' > ');
  }
  function pick() {
    if(window!==window.top) return;
    stopPicker?.();
    const restoreFocus=document.activeElement;
    const host=document.createElement('div');
    host.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important';
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      :host{all:initial} *{box-sizing:border-box} .cover{position:fixed;inset:0;pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none} .box{position:fixed;border:3px solid #086e83;background:#086e8322;pointer-events:none}
      .panel{position:fixed;bottom:max(16px,env(safe-area-inset-bottom));left:12px;right:12px;margin:auto;max-width:480px;padding:18px;background:#fff;color:#162c39;border:1px solid #b4c9d2;border-radius:18px;box-shadow:0 4px 40px #0004;font:16px/1.4 system-ui;pointer-events:auto}
      p{margin:0 0 10px} button{min-height:44px;padding:10px 16px;border:1px solid #086e83;border-radius:10px;background:#086e83;color:white;font:600 15px system-ui;cursor:pointer} button:focus-visible{outline:3px solid #db7a0e;outline-offset:2px} button:disabled{opacity:.5} #cancel{background:white;color:#162c39} .actions{display:flex;gap:10px;flex-wrap:wrap} code{display:block;max-height:80px;overflow:auto;font:12px/1.4 ui-monospace;overflow-wrap:anywhere;margin:0 0 10px}
      </style><div class="cover"></div><div class="box" hidden></div><section class="panel" role="region" aria-label="Harbor element picker"><p id="message" role="status">Tap an element to select it. Then choose Hide element.</p><code id="selector"></code><div class="actions"><button id="hide" data-action="hide" disabled>Hide element</button><button id="parent" data-action="parent" disabled>Select parent</button><button id="cancel" data-action="cancel">Cancel</button></div></section>`;
    document.documentElement.append(host);
    const cover=shadow.querySelector('.cover'), box=shadow.querySelector('.box'), status=shadow.getElementById('message'), save=shadow.getElementById('hide'), parent=shadow.getElementById('parent');
    // iOS only turns a tap into a click on elements that handle clicks; pickerInput does the work.
    cover.onclick=()=>{};
    let target, selector, busy=false;
    function select(element) {
      if(!element || [document.body,document.documentElement,host].includes(element)) return;
      target=element; selector=selectorFor(target);
      const rect=target.getBoundingClientRect();
      box.hidden=false; box.style.cssText=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
      shadow.getElementById('selector').textContent=selector;
      save.disabled=!selector;parent.disabled=target.parentElement===document.body;
      status.textContent='This rule will hide matching elements on this site. You can remove it in My filters.';
    }
    function keyboard(event) {if(event.key==='Escape'&&!busy){event.preventDefault();stopPicker();}}
    stopPicker=()=>{pickerInput=null;host.remove();document.removeEventListener('keydown',keyboard,true);window.removeEventListener('scroll',reposition,true);restoreFocus?.focus?.();stopPicker=null;};
    function reposition(){if(target)select(target);}
    document.addEventListener('keydown',keyboard,true);window.addEventListener('scroll',reposition,true);
    async function hide(){
      if(busy||!selector)return;busy=true;save.disabled=true;parent.disabled=true;
      try {
        const result=await api.runtime.sendMessage({type:'addPicked',selector});
        if(!result?.ok)throw Error(result?.error ?? 'Could not save. Try again.');
        stopPicker();await refresh();
      } catch(error){status.textContent=error.message;save.disabled=false;parent.disabled=false;} finally{busy=false;}
    }
    const actions={hide,parent:()=>select(target?.parentElement),cancel:()=>stopPicker()};
    pickerInput=event=>{
      const path=event.composedPath(), at=path.indexOf(host);
      if(at<0)return;
      event.stopImmediatePropagation();
      if(event.type!=='click'||busy)return;
      const inside=path.slice(0,at), button=inside.find(node=>node.dataset?.action);
      if(button){if(!button.disabled)actions[button.dataset.action]();}
      // An ad frame is picked as its <iframe>: taps reach the cover, never the frame.
      else if(inside[0]===cover)select(document.elementsFromPoint(event.clientX,event.clientY).find(node=>node!==host));
    };
    shadow.getElementById('cancel').focus();
  }
  api.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    let response;
    if(message.type==='pageStatus')response={consent:globalThis.HarborConsent?.status()??'Unavailable'};
    if(message.type==='refresh'){void refresh();response={ok:true};}
    if(message.type==='pick'){pick();response={ok:true};}
    if(response===undefined)return;
    // sendResponse works in every browser; Chromium (tested on 141) ignores a returned Promise.
    if(typeof sendResponse==='function'){sendResponse(response);return;}
    return Promise.resolve(response);
  });
  if(document.documentElement) void refresh(); else document.addEventListener('DOMContentLoaded',refresh,{once:true});
})();
