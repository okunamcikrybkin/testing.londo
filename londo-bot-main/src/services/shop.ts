import { ButtonBuilder, ButtonStyle, ChannelType, ContainerBuilder, DiscordAPIError, escapeMarkdown, MessageFlags, PermissionFlagsBits, SectionBuilder, SeparatorBuilder, TextDisplayBuilder, type Guild, type Interaction, type Role } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { logWarning } from "../utils/logger.js";
export type ShopItem = { id: string; name: string; price: string; isActive: boolean; sortOrder: number; deletedAt?: string | null };
export type Shop = { family: string; title: string; description: string; closedText: string | null; status: string; discordChannelId: string | null; discordMessageId: string | null; items: ShopItem[] };
type Pending = { id: string; discordUserId: string; discordRoleId: string | null };
export function safeShopRole(role: Pick<Role,"id" | "managed" | "editable" | "tags">, guildId: string): boolean { return role.id !== guildId && !role.managed && !role.tags?.botId && !role.tags?.integrationId && role.editable; }
export function buildShopPanel(shop: Shop, page = 0) {
  const items = shop.items.filter(item => item.isActive && !item.deletedAt).sort((a,b) => a.sortOrder - b.sortOrder);
  const pages = Math.max(1, Math.ceil(items.length / 8));
  page = Math.min(Math.max(0,page),pages-1);
  const container = new ContainerBuilder().setAccentColor(0x5c1823).addTextDisplayComponents(new TextDisplayBuilder().setContent("## " + escapeMarkdown(shop.title) + "\n" + escapeMarkdown(shop.status === "OPEN" ? shop.description : shop.closedText || "Магазин закрыт.")));
  for (const item of items.slice(page*8,page*8+8)) container.addSeparatorComponents(new SeparatorBuilder()).addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent("**" + escapeMarkdown(item.name) + "**\nЦена: " + Number(item.price).toLocaleString("ru-RU",{maximumFractionDigits:4}) + " 🪙")).setButtonAccessory(new ButtonBuilder().setCustomId("shop:buy:"+item.id).setLabel("Купить").setStyle(ButtonStyle.Success).setDisabled(shop.status !== "OPEN")));
  if (!items.length) container.addTextDisplayComponents(new TextDisplayBuilder().setContent("Товаров пока нет."));
  if (pages > 1) container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent("Страница " + (page+1) + " / " + pages)).setButtonAccessory(new ButtonBuilder().setCustomId("shop:page:"+shop.family+":"+((page+1)%pages)).setLabel("Следующая страница").setStyle(ButtonStyle.Secondary)));
  return { components: [container], flags: MessageFlags.IsComponentsV2 as const, allowedMentions: { parse: [] as [] } };
}
export class ShopManager {
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private locks = new Map<string, Promise<unknown>>();
  constructor(private guild: Guild, private config: SiteLogConfig) {}
  async request<T>(body?: object): Promise<T> {
    const response = await fetch(new URL("/api/internal/shop", this.config.siteUrl), { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-londo-bot-secret": this.config.apiSecret }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(35000) });
    const result = await response.json() as T & { code?: string };
    if (!response.ok) throw new Error(result.code || "SHOP_UNAVAILABLE");
    return result;
  }
  private async serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.locks.set(key,next);
    try { return await next; } finally { if(this.locks.get(key) === next) this.locks.delete(key); }
  }
  async options() {
    await Promise.all([this.guild.roles.fetch(),this.guild.channels.fetch()]);
    const me = await this.guild.members.fetchMe();
    return { channels: this.guild.channels.cache.filter(c => c.type === ChannelType.GuildText && Boolean(c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]))).map(c => ({id:c.id,name:c.name})), roles: this.guild.roles.cache.filter(r => safeShopRole(r,this.guild.id) && me.permissions.has(PermissionFlagsBits.ManageRoles) && r.comparePositionTo(me.roles.highest)<0).map(r => ({id:r.id,name:r.name,position:r.position})).sort((a,b)=>b.position-a.position) };
  }
  async roleCheck(discordUserId: string, roleId: string) {
    try {
      const [member, role, me] = await Promise.all([this.guild.members.fetch({user:discordUserId,force:true}),this.guild.roles.fetch(roleId),this.guild.members.fetchMe()]);
      if (member.roles.cache.has(roleId)) return {code:"ALREADY_OWNED"};
      if (!role || !safeShopRole(role,this.guild.id) || !me.permissions.has(PermissionFlagsBits.ManageRoles) || role.comparePositionTo(me.roles.highest)>=0) return {code:"ROLE_UNAVAILABLE"};
      return {code:"OK"};
    } catch (error) { if (error instanceof DiscordAPIError && [10007,10011].includes(Number(error.code))) return {code:"ROLE_UNAVAILABLE"}; throw error; }
  }
  async refresh(family: string) {
    return this.serial("panel:"+family, async () => {
      const {shops} = await this.request<{shops:Shop[]}>();
      const shop = shops.find(s=>s.family===family);
      if (!shop?.discordChannelId) throw new Error("CHANNEL_UNAVAILABLE");
      const channel = await this.guild.channels.fetch(shop.discordChannelId);
      if (channel?.type !== ChannelType.GuildText) throw new Error("CHANNEL_UNAVAILABLE");
      let message = null;
      if (shop.discordMessageId) {
        try { message = await channel.messages.fetch(shop.discordMessageId); }
        catch(error) { if (!(error instanceof DiscordAPIError && error.code === 10008)) throw error; }
      }
      if (message) { if(message.author.id!==this.guild.client.user.id) throw new Error("INVALID_PANEL"); await message.edit(buildShopPanel(shop)); return; }
      // Recover a successful send whose acknowledgement was lost, before creating another panel.
      const marker = "## " + shop.title;
      const recent = await channel.messages.fetch({limit:100});
      const recovered = recent.find(m => m.author.id === this.guild.client.user.id && JSON.stringify(m.components).includes(marker));
      const payload = buildShopPanel(shop);
      if (recovered) await recovered.edit(payload);
      const created = recovered ?? await channel.send(payload);
      await this.request({operation:"PANEL",family,channelId:channel.id,messageId:created.id,previousMessageId:shop.discordMessageId});
      if (shop.discordMessageId && shop.discordMessageId !== created.id) {
        // A moved panel is looked up only in channels this bot can access.
        for (const old of this.guild.channels.cache.values()) if (old.type===ChannelType.GuildText && old.id!==channel.id) {
          try { const stale = await old.messages.fetch(shop.discordMessageId); if(stale.author.id===this.guild.client.user.id) await stale.delete(); break; } catch { /* best-effort cleanup */ }
        }
      }
    });
  }
  async fulfill(purchase: Pending) {
    return this.serial("role:"+purchase.id,async () => {
      // Re-read pending state after obtaining the lock, avoiding stale retry/refund races.
      const state = await this.request<{pending:Pending[]}>();
      if (!state.pending.some(p=>p.id===purchase.id)) return;
      const roleId = purchase.discordRoleId;
      if (!roleId) { await this.request({operation:"SETTLE",id:purchase.id,refund:true}); return; }
      const checked = await this.roleCheck(purchase.discordUserId,roleId);
      if (checked.code === "ALREADY_OWNED") { await this.request({operation:"SETTLE",id:purchase.id,refund:false}); return; }
      if (checked.code !== "OK") { await this.request({operation:"SETTLE",id:purchase.id,refund:true}); return; }
      try { const member = await this.guild.members.fetch({user:purchase.discordUserId,force:true}); await member.roles.add(roleId,"LONDO Family Shop "+purchase.id); }
      catch {
        // A timeout can mean Discord accepted the grant. Check authoritative membership before refunding.
        const member = await this.guild.members.fetch({user:purchase.discordUserId,force:true});
        await this.request({operation:"SETTLE",id:purchase.id,refund:!member.roles.cache.has(roleId)}); return;
      }
      await this.request({operation:"SETTLE",id:purchase.id,refund:false});
    });
  }
  start() { void this.poll(); this.timer=setInterval(()=>void this.poll(),30000); this.timer.unref(); }
  stop() { if(this.timer) clearInterval(this.timer); }
  private async poll() { if(this.polling)return; this.polling=true; try { const state=await this.request<{pending:Pending[]}>(); for(const p of state.pending) { try { await this.fulfill(p); } catch { logWarning("[SHOP] A pending role purchase will retry."); } } } catch { logWarning("[SHOP] Pending role processing will retry."); } finally {this.polling=false;} }
  async handleInteraction(interaction: Interaction) {
    if(!interaction.isButton() || !interaction.customId.startsWith("shop:"))return false;
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try {
      if(interaction.guildId !== this.guild.id) throw new Error("WRONG_FAMILY");
      if(interaction.customId.startsWith("shop:page:")) { const [, , family, page]=interaction.customId.split(":"); const {shops}=await this.request<{shops:Shop[]}>(); const shop=shops.find(s=>s.family===family); if(!shop)throw new Error("SHOP_UNAVAILABLE"); await interaction.editReply(buildShopPanel(shop,Number(page)||0)); return true; }
      const result=await this.request<{purchase:{id:string;type:string;status:string}}>({operation:"BUY",itemId:interaction.customId.slice("shop:buy:".length),discordUserId:interaction.user.id,interactionId:interaction.id});
      if(result.purchase.type === "DISCORD_ROLE") { const {pending}=await this.request<{pending:Pending[]}>(); const p=pending.find(p=>p.id===result.purchase.id); if(p)await this.fulfill(p); const outcome = await this.request<{purchase:{status:string}}>({operation:"RESULT",id:result.purchase.id}); await interaction.editReply(outcome.purchase.status === "COMPLETED" ? "Покупка завершена. Роль выдана." : outcome.purchase.status === "REFUNDED" ? "Не удалось выдать роль. Монеты возвращены." : "Покупка оплачена. Выдача роли обрабатывается автоматически."); }
      else await interaction.editReply("Покупка оплачена. Ожидайте выдачи товара сотрудником семьи.");
    } catch(error) {
      const messages:Record<string,string>={ALREADY_OWNED:"У вас уже есть этот товар.",INSUFFICIENT_BALANCE:"Недостаточно монет.",SHOP_CLOSED:"Магазин закрыт.",WRONG_FAMILY:"Вы не состоите в нужной семье.",ITEM_UNAVAILABLE:"Товар недоступен.",ROLE_PENDING:"Предыдущая покупка роли ещё обрабатывается.",ROLE_UNAVAILABLE:"Роль сейчас недоступна."};
      await interaction.editReply(messages[error instanceof Error?error.message:""] || "Не удалось подтвердить результат. Незавершённые покупки ролей обрабатываются автоматически; проверьте историю покупок.");
    }
    return true;
  }
}
