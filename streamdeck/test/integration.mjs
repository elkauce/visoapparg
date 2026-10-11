import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = new WebSocketServer({port:0});await new Promise(r=>server.once('listening',r));
const info={application:{version:'7.1.0',platform:'windows',platformVersion:'10.0',language:'es'},plugin:{uuid:'com.viso.deck',version:'1.0.0.0'},devices:[{id:"test-device",name:"Stream Deck",type:0,size:{columns:5,rows:3}}],colors:{},devicePixelRatio:1};
const child=spawn(process.execPath,['--import',fileURLToPath(new URL('./fetch-fixture.mjs', import.meta.url)),'bin/plugin.mjs','-port',String(server.address().port),'-pluginUUID','test-plugin','-registerEvent','registerPlugin','-info',JSON.stringify(info)],{cwd:fileURLToPath(new URL('../com.viso.deck.sdPlugin',import.meta.url)),stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',d=>errors+=d);const messages=[];
try {
 const socket=await Promise.race([new Promise(r=>server.once('connection',r)),new Promise((_,r)=>setTimeout(()=>r(new Error('Plugin connection timeout: '+errors)),5000))]);
 socket.on('message',d=>messages.push(JSON.parse(d)));
 const wait=async(event)=>{for(let i=0;i<100;i++){const found=messages.find(m=>m.event===event);if(found)return found;await new Promise(r=>setTimeout(r,30));}throw new Error('Missing '+event+' '+errors);};
 await wait('registerPlugin');
 const settings={url:`https://example.convex.site/deck/set?token=${'a'.repeat(48)}&status=busy`,label:'OCUPADO'};
 const base={action:'com.viso.deck.state',context:'test-key',device:'test-device',payload:{settings,coordinates:{column:0,row:0},controller:'Keypad',isInMultiAction:false}};
 socket.send(JSON.stringify({...base,event:'willAppear'}));assert.equal((await wait('setTitle')).payload.title,'OCUPADO');
 socket.send(JSON.stringify({...base,event:'keyDown'}));await wait('showOk');
 socket.send(JSON.stringify({...base,event:'didReceiveSettings',payload:{...base.payload,settings:{label:'Sin configurar'}}}));
 socket.send(JSON.stringify({...base,event:'keyDown',payload:{...base.payload,settings:{}}}));await wait('showAlert');
 console.log(JSON.stringify({passed:4,scope:'Bundled official SDK websocket registration, title, confirmed press, unconfigured alert; external HTTP fixture, no physical hardware'},null,2));
} finally {child.kill();for(const s of server.clients)s.terminate();server.close();}
