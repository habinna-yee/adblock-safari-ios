// Local UI review only: browser extension APIs below are mocked, not Safari.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
let listener,stored={},rules=[],origin;
const event={addListener(){}};
globalThis.browser={runtime:{getURL:p=>`${origin}/${p}`,onMessage:{addListener:fn=>listener=fn},onInstalled:event,onStartup:event},storage:{local:{async get(key){return {[key]:structuredClone(stored[key])};},async set(values){Object.assign(stored,structuredClone(values));}}},declarativeNetRequest:{async getDynamicRules(){return structuredClone(rules);},async updateDynamicRules({addRules}){rules=structuredClone(addRules);},async updateEnabledRulesets(){}},tabs:{async query(){return [];},async sendMessage(){}}};
const apiSource=`window.browser={runtime:{sendMessage:async(message)=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)});return r.json();},openOptionsPage:async()=>{location.href='/options.html';}},tabs:{query:async()=>[{id:1,url:'https://news.example/article'}],sendMessage:async()=>({consent:'Preview only — extension APIs are simulated'}),reload:async()=>{}}};`;
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&req.url==='/rpc'){let body='';for await(const part of req){body+=part;if(body.length>300000)throw Error('Request too large');}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await listener(JSON.parse(body),{url:`${origin}/options.html` })));return;}
  if(req.url==='/preview-api.js'){res.setHeader('Content-Type','text/javascript');res.end(apiSource);return;}
  const pathname=new URL(req.url,origin).pathname;
  const folder=pathname.startsWith('/tests/')?root:path.join(root,'Extension');
  const file=path.resolve(folder,'.'+(pathname==='/'?'/options.html':pathname));
  if(!file.startsWith(folder+path.sep))throw Error('Not found');
  let data=await fs.readFile(file);const ext=path.extname(file);
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'})[ext]??'text/plain');
  if(ext==='.html'&&!pathname.startsWith('/tests/'))data=Buffer.from(data.toString().replace('<head>','<head><script src="/preview-api.js"></script>').replace('<body','<body').replace('<main', '<aside style="padding:8px;text-align:center;background:#ffe8bf;color:#573200;font:13px system-ui">Interface preview · Extension APIs simulated</aside><main'));
  res.end(data);
 }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end(error.message);}
});
await new Promise(resolve=>server.listen(Number(process.env.PORT??8765),'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
await import('../Extension/background.js');console.log(`UI preview: ${origin}/options.html\nConsent fixture suite: ${origin}/tests/consent-browser.html`);
