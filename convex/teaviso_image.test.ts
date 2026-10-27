import {convexTest} from "convex-test";
import {describe,expect,it} from "vitest";
import schema from "./schema";
import {modules} from "./test.setup";
import {api} from "./_generated/api";
const png=()=>new Uint8Array([137,80,78,71,13,10,26,10]);
describe("Te Aviso: subida privada de logos",()=>{
 it("accepts a basic authenticated account without requiring a Marketplace creator profile",async()=>{
  const t=convexTest(schema,modules);const owner=await t.run(ctx=>ctx.db.insert("users",{email:"logo@fixture.example"}));const me=t.withIdentity({subject:`${owner}|test`});
  const response=await me.fetch("/teaviso/image",{method:"POST",headers:{"Content-Type":"image/png"},body:png()});expect(response.status).toBe(200);
  const {imageId}=await response.json();const image=await t.run(ctx=>ctx.db.get("teavisoImages",imageId));expect(image?.ownerId).toBe(owner);
  const other=await t.run(ctx=>ctx.db.insert("users",{email:"other@fixture.example"}));
  await expect(t.withIdentity({subject:`${other}|test`}).mutation(api.teaviso_spaces.registerImage,{storageId:image!.storageId})).rejects.toThrow("acceso");
 });
 it("rejects unauthenticated uploads before storing a file",async()=>{
  const t=convexTest(schema,modules);const response=await t.fetch("/teaviso/image",{method:"POST",headers:{"Content-Type":"image/png"},body:png()});expect(response.status).toBe(401);expect(await t.run(ctx=>ctx.db.query("teavisoImages").collect())).toHaveLength(0);
 });
 it("rejects spoofed formats and limits the streaming body to 2 MB",async()=>{
  const t=convexTest(schema,modules);const id=await t.run(ctx=>ctx.db.insert("users",{email:"size@fixture.example"}));const me=t.withIdentity({subject:`${id}|test`});
  expect((await me.fetch("/teaviso/image",{method:"POST",headers:{"Content-Type":"image/png"},body:"<svg>not a PNG</svg>"})).status).toBe(400);
  expect((await me.fetch("/teaviso/image",{method:"POST",headers:{"Content-Type":"image/png"},body:new Uint8Array(2_000_001)})).status).toBe(413);
  expect(await t.run(ctx=>ctx.db.query("teavisoImages").collect())).toHaveLength(0);
 });
});
