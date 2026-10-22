import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrNull, requireCurrentUser } from "./lib/current_user.ts";

const modes = v.union(v.literal("audio"), v.literal("video"));
const states = v.union(v.literal("ringing"),v.literal("accepted"),v.literal("rejected"),v.literal("ended"));
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(20)),x=>x.toString(16).padStart(2,"0")).join("");}
export const mine = query({args:{},handler:async(ctx)=>{
 const user=await getCurrentUserOrNull(ctx); if(!user)return null;
 return await ctx.db.query("doorbells").withIndex("by_user",q=>q.eq("userId",user._id)).first();
}});
export const ensureMine = mutation({args:{},handler:async(ctx)=>{
 const user=await requireCurrentUser(ctx);
 const old=await ctx.db.query("doorbells").withIndex("by_user",q=>q.eq("userId",user._id)).first();
 if(old)return old.slug;
 const slug=secret(); await ctx.db.insert("doorbells",{userId:user._id,slug,enabled:true,allowAudio:true,allowVideo:true,lightAlert:false});return slug;
}});
export const configure = mutation({args:{enabled:v.boolean(),allowAudio:v.boolean(),allowVideo:v.boolean(),lightAlert:v.boolean()},handler:async(ctx,a)=>{
 const user=await requireCurrentUser(ctx);
 const item=await ctx.db.query("doorbells").withIndex("by_user",q=>q.eq("userId",user._id)).first();
 if(!item)throw new ConvexError("Timbre no configurado");
 await ctx.db.patch(item._id,{enabled:a.enabled,allowAudio:a.allowAudio,allowVideo:a.allowVideo,lightAlert:a.lightAlert});
}});
export const publicInfo = query({args:{slug:v.string()},handler:async(ctx,{slug})=>{
 const bell=await ctx.db.query("doorbells").withIndex("by_slug",q=>q.eq("slug",slug)).first();
 if(!bell)return null;return {enabled:bell.enabled,allowAudio:bell.allowAudio,allowVideo:bell.allowVideo};
}});
export const ring = mutation({args:{slug:v.string(),mode:modes},handler:async(ctx,{slug,mode})=>{
 const bell=await ctx.db.query("doorbells").withIndex("by_slug",q=>q.eq("slug",slug)).first();
 if(!bell||!bell.enabled|| (mode==="audio"&&!bell.allowAudio)||(mode==="video"&&!bell.allowVideo))throw new ConvexError("Timbre no disponible");
 const recent=await ctx.db.query("doorbellCalls").withIndex("by_bell_created",q=>q.eq("bellId",bell._id)).order("desc").take(10);
 if(recent.some(x=>x.state==="ringing" && Date.now()-x.createdAt<60000))throw new ConvexError("Ya hay una llamada pendiente");
 if(recent.filter(x=>Date.now()-x.createdAt<60000).length>=3)throw new ConvexError("Intenta nuevamente en un minuto");
 const token=secret(),createdAt=Date.now();
 const id=await ctx.db.insert("doorbellCalls",{bellId:bell._id,userId:bell.userId,visitorToken:token,mode,state:"ringing",createdAt,ownerSignals:[],visitorSignals:[]});
 return {id,token};
}});
export const incoming=query({args:{},handler:async(ctx)=>{
 const user=await getCurrentUserOrNull(ctx);if(!user)return [];
 const calls=await ctx.db.query("doorbellCalls").withIndex("by_user",q=>q.eq("userId",user._id)).order("desc").take(20);
 return calls.filter(c=>Date.now()-c.createdAt<3600000).map(c=>({id:c._id,mode:c.mode,state:c.state,createdAt:c.createdAt,visitorSignals:c.visitorSignals}));
}});
export const ownerSetState=mutation({args:{id:v.id("doorbellCalls"),state:states},handler:async(ctx,{id,state})=>{
 const user=await requireCurrentUser(ctx),c=await ctx.db.get(id);
 if(!c||c.userId!==user._id)throw new ConvexError("Sin acceso");
 if(c.state==="ended"||c.state==="rejected")return;
 await ctx.db.patch(id,{state});
}});
export const visitorCall=query({args:{id:v.id("doorbellCalls"),token:v.string()},handler:async(ctx,{id,token})=>{
 const c=await ctx.db.get(id);if(!c||c.visitorToken!==token)return null;
 return {state:c.state,ownerSignals:c.ownerSignals};
}});
export const visitorHangup=mutation({args:{id:v.id("doorbellCalls"),token:v.string()},handler:async(ctx,{id,token})=>{
 const c=await ctx.db.get(id);if(!c||c.visitorToken!==token)throw new ConvexError("Sin acceso");
 await ctx.db.patch(id,{state:"ended"});
}});
const signal=v.object({type:v.string(),data:v.string()});
export const sendVisitorSignal=mutation({args:{id:v.id("doorbellCalls"),token:v.string(),signal},handler:async(ctx,{id,token,signal})=>{
 const c=await ctx.db.get(id);if(!c||c.visitorToken!==token||!["ringing","accepted"].includes(c.state))throw new ConvexError("Sin acceso");
 if(signal.data.length>20000||c.visitorSignals.length>=100)throw new ConvexError("Límite de señalización");
 await ctx.db.patch(id,{visitorSignals:[...c.visitorSignals,signal]});
}});
export const sendOwnerSignal=mutation({args:{id:v.id("doorbellCalls"),signal},handler:async(ctx,{id,signal})=>{
 const u=await requireCurrentUser(ctx),c=await ctx.db.get(id);
 if(!c||c.userId!==u._id||!["ringing","accepted"].includes(c.state))throw new ConvexError("Sin acceso");
 if(signal.data.length>20000||c.ownerSignals.length>=100)throw new ConvexError("Límite de señalización");
 await ctx.db.patch(id,{ownerSignals:[...c.ownerSignals,signal]});
}});
