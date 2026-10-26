import { verify } from "node:crypto";
import { discordApi, DiscordIntegrationError } from "@/lib/discord/client";
import { publicApplyUrl } from "@/lib/discord-checks/policy";
function publicKey(): Buffer {
  const key = process.env.DISCORD_APPLICATION_PUBLIC_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new DiscordIntegrationError("Discord interactions are not configured.");
  }

  // Ed25519 SubjectPublicKeyInfo prefix required by Node.js crypto.verify.
  return Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key, "hex")]);
}

export function isValidDiscordInteraction(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  if (!signature || !timestamp || !/^[a-fA-F0-9]{128}$/.test(signature)) {
    return false;
  }

  try {
    return verify(
      null,
      Buffer.from(`${timestamp}${rawBody}`),
      { format: "der", key: publicKey(), type: "spki" },
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}


export async function handleDiscordApplicationInteraction(interaction: {type:number}) {
 if(interaction.type===1)return Response.json({type:1});
 const url=publicApplyUrl();
 return Response.json({type:4,data:{flags:64,content:"Подача заявок перенесена на сайт LONDO."+(url?"":" Публичная ссылка пока не настроена."),components:url?[{type:1,components:[{type:2,style:5,label:"Подать заявку на сайте",url}]}]:[]}});
}
export async function publishApplicationEntryMessage(channelId:string):Promise<{id:string}>{
 const url=publicApplyUrl();if(!url)throw new DiscordIntegrationError("PUBLIC_SITE_URL не настроен: публикация пропущена.");
 if(!/^\d{16,22}$/.test(channelId))throw new DiscordIntegrationError("Discord channel ID is invalid.");
 return discordApi(`/channels/${channelId}/messages`,{method:"POST",body:JSON.stringify({flags:32768,components:[{type:17,components:[{type:10,content:"# Вступление в семью LONDO\nПодача заявок перенесена на официальный сайт."},{type:1,components:[{type:2,style:5,label:"Подать заявку на сайте ↗",url}]}]}]})});
}
