import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./',import.meta.url)));
const assets=path.resolve(root,'../../../apps/teaviso/public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');let p=url.pathname;const base=p.startsWith('/assets/')?assets:root;p=p.startsWith('/assets/')?p.slice(8):p==='/'?'index.html':p.slice(1);const f=path.resolve(base,p);if(!f.startsWith(base+path.sep)){res.writeHead(403).end();return;}const content=await readFile(f);res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);}catch{res.writeHead(404).end();}}).listen(5211,'127.0.0.1',()=>console.log('Local home design: http://127.0.0.1:5211 (no backend).'));
