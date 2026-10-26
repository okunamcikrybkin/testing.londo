import {CheckError} from "./discord-api";
// One shared queue per candidate/consent in this site process. No tokens in keys or logs.
export class RoleQueue {
 private tail:Promise<unknown>=Promise.resolve();
 private inFlight=new Map<string,Promise<unknown>>();
 private until=0;
 private cache=new Map<string,{value:unknown;expires:number}>();
 constructor(private now=()=>Date.now()){}
 observe(response:Response,body:unknown){
  const data=body as {retry_after?:unknown}|null;
  const seconds=(v:unknown)=>typeof v==="number"||typeof v==="string"&&v!==""?Math.max(0,Number(v)||0):0;
  let delay=0;
  if(response.headers.get("X-RateLimit-Remaining")==="0")delay=seconds(response.headers.get("X-RateLimit-Reset-After"));
  if(response.status===429)delay=Math.max(delay,seconds(response.headers.get("Retry-After")),seconds(data?.retry_after),1);
  this.until=Math.max(this.until,this.now()+delay*1000);
 }
 run<T>(key:string,work:()=>Promise<T>,ttl=0,cacheable:(value:T)=>boolean=()=>false):Promise<T>{
  for(const [id,item] of this.cache)if(item.expires<=this.now())this.cache.delete(id);
  const cached=this.cache.get(key);if(cached)return Promise.resolve(cached.value as T);
  const active=this.inFlight.get(key);if(active)return active as Promise<T>;
  if(this.inFlight.size>=20)return Promise.reject(new CheckError("RATE_LIMITED",undefined,undefined,1000));
  const task=this.tail.catch(()=>{}).then(async()=>{
   const remaining=this.until-this.now();
   // Keep the queue paused; return a retry time instead of holding an HTTP request for minutes.
   if(remaining>0)throw new CheckError("RATE_LIMITED",undefined,undefined,remaining);
   const result=await work();
   if(ttl>0&&cacheable(result))this.cache.set(key,{value:result,expires:this.now()+ttl});
   return result;
  });
  this.tail=task.catch(()=>{});this.inFlight.set(key,task);
  void task.finally(()=>this.inFlight.delete(key)).catch(()=>{});
  return task;
 }
}
const shared=globalThis as typeof globalThis&{londoRoleQueues?:Map<string,{queue:RoleQueue;used:number}>};
const queues:Map<string,{queue:RoleQueue;used:number}>=shared.londoRoleQueues??=new Map<string,{queue:RoleQueue;used:number}>();
export function candidateRoleQueue(key:string):RoleQueue{
 const now=Date.now();for(const [id,value] of queues)if(now-value.used>24*60*60*1000)queues.delete(id);
 let entry=queues.get(key);if(!entry){entry={queue:new RoleQueue(),used:now};queues.set(key,entry);}entry.used=now;return entry.queue;
}
