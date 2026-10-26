import type {SiteLogConfig} from "../config/siteLogs.js";
import {logWarning} from "../utils/logger.js";
/** Removes expired private check data even when staff are not viewing applications. */
export function startDiscordCheckRetention(config:SiteLogConfig){
 let running=false;
 const tick=async()=>{if(running)return;running=true;try{const r=await fetch(new URL("/api/internal/discord-checks/prune",config.siteUrl),{method:"POST",headers:{"x-londo-bot-secret":config.apiSecret},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();}catch{logWarning("[Discord checks] Retention cleanup unavailable; retrying in 15 minutes.");}finally{running=false;}};
 const timer=setInterval(()=>void tick(),15*60*1000);timer.unref();void tick();return timer;
}
