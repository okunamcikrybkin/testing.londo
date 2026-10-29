"use client";
import {RankLabel} from "@/components/rank-label";
import {FamilyServerIcon} from "@/components/family-server-icon";
import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { GAME_LABELS, profileUrl, type ProfileData, type ProfileSettings } from "@/lib/profile-customization/settings";
import s from "./profile-view.module.css";
import {framePresentation} from "@/lib/profile-customization/frames";
import {profileNameStyle} from "@/lib/profile-customization/name-accent";
import {profileAppearance} from "@/lib/profile-customization/surface-colors";
export {PROFILE_COLORS} from "@/lib/profile-customization/colors";
export type ProfileViewProps = { profile: ProfileData; settings: ProfileSettings; owner?: boolean; discordRoles?: string[] };
function profileStyle(settings: ProfileSettings): CSSProperties { return profileAppearance(settings) as CSSProperties; }
const familyArt: Record<string, string> = { MEMPHIS: "/branding/memphis-server.png" };
const gameArt: Record<string, string> = { GTA_V: "/games/gta5.png", CS2: "/games/counter_strike2.svg", VALORANT: "/games/valorant.png", DOTA_2: "/games/dota2.png", MINECRAFT: "/games/minecraft.png", RUST: "/games/rust.png", APEX: "/games/apex_legends.png", FORTNITE: "/games/fortnite.png" };
function safeUrl(value: string | null, banner = false) { try { return value ? profileUrl(value, banner) : null; } catch { return null; } }
function ProfileRank({rank,profile}:{rank:string;profile:ProfileData}) {
  const family = rank.startsWith("MEMPHIS · ") ? "MEMPHIS" : null;
  const label = family ? rank.slice(family.length + 3) : rank;
  return <span className="inline-flex items-center gap-1.5">{family && <FamilyServerIcon family={family} size="inline" />}<RankLabel roleId={profile.rankRoleIds?.[rank]} colors={profile.rankColors}>{label}</RankLabel></span>;
}

export function ProfileBanner({ settings, mini = false }: { settings: ProfileSettings; mini?: boolean }) {
  const custom = safeUrl(settings.customBannerUrl, true);
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={s.banner} data-mini={mini} data-preset={custom && custom !== failed ? "CUSTOM" : settings.bannerPreset}>
    {custom && custom !== failed ? <Image src={custom} alt="" fill unoptimized referrerPolicy="no-referrer" onError={() => setFailed(custom)} sizes="(max-width: 768px) 100vw, 1240px" /> : <>
      <div className={s.bannerType} aria-hidden="true">LONDO</div>
      {settings.bannerPreset !== "NONE" && <Image className={s.bannerArt} src="/branding/londo-logo.png" alt="" width={600} height={600} priority={!mini} />}
    </>}
    {!mini && settings.bannerPreset !== "NONE" && <div className={s.bannerCaption}><span>THE PEOPLE MAKE THE FAMILY.</span><span>LOS SANTOS / LONDO</span></div>}
  </div>;
}

export function ProfileAvatar({ profile, frame, frameColor, small = false }: { profile: ProfileData; frame: ProfileSettings["avatarFrame"]; frameColor?: string | null; small?: boolean }) {
  const decoration=framePresentation(frame,frameColor);
  const url = safeUrl(profile.avatarUrl);
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={s.avatar} data-frame={decoration.style} data-small={small} style={{"--frame-color":decoration.color} as CSSProperties}>{url && url !== failed ? <Image src={url} alt="" width={144} height={144} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <span aria-hidden="true">{profile.displayName.slice(0, 1)}</span>}</span>;
}

export function ProfileBadges({ badges }: { badges: string[] }) {
  if (!badges.length) return null;
  return <div className={s.badges} aria-label="Бейджи участника">{badges.map(b => <span key={b} className={s.badge} tabIndex={0} data-badge={b} aria-label={`Бейдж ${b}`}>
    {familyArt[b] ? <Image src={familyArt[b]} alt="" width={22} height={22} /> : b === "LND" ? <Image src="/branding/londo-logo.png" alt="" width={22} height={22} /> : <span className={s.badgeSymbol} aria-hidden="true">{b === "MAIN" ? "✦" : b === "OWNER" ? "♜" : "L"}</span>}
    <span>{b === "LND" ? "LONDO" : b}</span><span className={s.tooltip}>{b === "LND" ? "Участник семьи LONDO" : b === "MAIN" ? "Основной ранг · Main" : b}</span>
  </span>)}</div>;
}


/** Public callers must pass the server-side profileProjection, never raw private data. */
export function ProfileView({profile, settings, owner=false, discordRoles=[]}: ProfileViewProps) {
 const families=profile.families ?? [];
 const visibleDiscordRoles=discordRoles.filter(role=>role.trim().toLocaleLowerCase("ru-RU")!=="memphis");
 const hasDetails=Boolean(settings.bio || settings.links.length || settings.games.length || settings.characters.length || families.length || profile.ranks?.length || discordRoles.length || profile.coins !== undefined || profile.voiceTime !== undefined || owner);
 return <div className={s.scope} data-profile-customization="true" style={profileStyle(settings)}>      <article className={s.profile} data-layout="CLASSIC" data-card="MATTE" aria-label="Профиль участника LONDO">
        <ProfileBanner settings={settings} />
        <div className={s.identity} data-ui-profile="identity">
          <div className={s.avatarButton}><ProfileAvatar profile={profile} frame={settings.avatarFrame} frameColor={settings.avatarFrameColor} /></div>
          <div className={s.identityTop}><span className={s.eyebrow}>LONDO / ЛИЧНОЕ ПРОСТРАНСТВО</span>{owner && <Link className={s.editButton} href="/profile/customize">Настроить профиль ↗</Link>}</div>
          <div className={s.identityRow}><div><h2 className={s.displayName} style={profileNameStyle(settings.accentColor)}>{profile.displayName}</h2><div className={s.handles}>{profile.username && <span>@{profile.username}</span>}{profile.gameNickname && <span>{profile.gameNickname}</span>}{profile.staticId && <span>Static #{profile.staticId}</span>}{settings.showBirthday && profile.birthday && <span>День рождения: {profile.birthday}</span>}</div></div><ProfileBadges badges={settings.selectedBadges} /></div>
          {settings.customStatus && <p className={s.status}><span aria-hidden="true">“</span>{settings.customStatus}<small>Личный статус</small></p>}
        </div>

        {hasDetails && <div className={s.body} data-ui-profile="body" data-sidebar={Boolean(settings.links.length || settings.games.length)}>
          <div className={s.mainColumn}>
            {settings.bio ? <section className={s.about}><h2>За ником — человек.</h2><p className={s.eyebrow}>О СЕБЕ</p><p className={s.bio}>{settings.bio}</p></section> : owner && <section className={s.about}><h2>Твоя история начинается здесь.</h2><Link className={s.textLink} href="/profile/customize">Добавить информацию о себе ↗</Link></section>}
            {(families.length > 0 || Boolean(profile.ranks?.length) || visibleDiscordRoles.length > 0) && <section className={s.familySection}><h2 className={s.sectionTitle}>Место в семье <span>LONDO COMMUNITY</span></h2>
              {families.map(f => <div key={f} className={s.family} data-family={f}>{familyArt[f] && <Image src={familyArt[f]} alt="" width={52} height={52} />}<div><span className={s.micro}>СЕРВЕР</span><h3>{f}</h3></div>{profile.ranks?.filter(r => r.startsWith(`${f} · `)).map(r => <div className={s.rank} key={r}><span className={s.micro}>РАНГ</span><strong><RankLabel roleId={profile.rankRoleIds?.[r]} colors={profile.rankColors}>{r.split(" · ").slice(1).join(" · ")}</RankLabel></strong></div>)}</div>)}
              {!families.length && profile.ranks?.map(r => <p key={r}><ProfileRank rank={r} profile={profile} /></p>)}
             </section>}{/* keep adjacent sections free of a literal newline text node */}
            {profile.characters?.length ? <section className={s.familySection}><h2 className={s.sectionTitle}>Дополнительные персонажи <span>СТАТИКИ</span></h2><div className={s.connections}>{profile.characters.filter(c=>c.enabled).sort((a,b)=>a.sortOrder-b.sortOrder).map(c=><div key={`${c.name}-${c.staticId}`} className="flex items-center justify-between border-t border-white/10 py-3 text-sm"><span>{c.name}</span><strong className="text-accent-soft">Static #{c.staticId}</strong></div>)}</div></section> : null}\n            {(profile.voiceTime !== undefined || profile.coins !== undefined) && <dl className={s.stats}>{profile.voiceTime !== undefined && <div><dt>В ГОЛОСОВЫХ</dt><dd>{profile.voiceTime}</dd><span>Время вместе</span></div>}{profile.coins !== undefined && <div><dt>LONDO COINS</dt><dd>{profile.coins}<small aria-label="монет"><svg viewBox="0 0 28 28" aria-hidden="true"><ellipse cx="14" cy="20" rx="9" ry="4.5" fill="#9d622d" /><path d="M5 16v4c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-4" fill="#d99b45" stroke="#f1c477" strokeWidth="1" /><ellipse cx="14" cy="16" rx="9" ry="4.5" fill="#f1bc59" stroke="#ffe09a" strokeWidth="1" /><circle cx="14" cy="16" r="3" fill="none" stroke="#bd792d" strokeWidth="1" /></svg></small></dd><span>Баланс участника</span></div>}</dl>}
          </div>
          {(settings.links.length > 0 || settings.games.length > 0) && <aside className={s.sideColumn}>
            {settings.links.length > 0 && <section><h2 className={s.sectionTitle}>Вне города <span>СВЯЗИ</span></h2><div className={s.connections}>{settings.links.slice().sort((a,b) => a.sortOrder-b.sortOrder).map((l,i) => { const url = safeUrl(l.url); return url && <a key={`${l.type}-${i}`} href={url} target="_blank" rel="noopener noreferrer nofollow ugc"><span className={s.connectionIcon} aria-hidden="true">{l.type === "TWITCH" ? "↳" : l.type === "TELEGRAM" ? "↗" : "▷"}</span><span><small>{l.type}</small><strong>{l.label || l.type}</strong></span><span aria-hidden="true">↗</span></a>; })}</div></section>}
            {settings.games.length > 0 && <section className={s.gamesSection}><h2 className={s.sectionTitle}>В моей коллекции <span>ИГРЫ</span></h2><ol className={s.games}>{settings.games.map((g,i) => <li key={g}><span className={s.gameNumber}>{String(i+1).padStart(2,"0")}</span><span className={s.gameInfo}><Image className={s.gameIcon} src={gameArt[g]} alt="" width={28} height={28} /><span>{GAME_LABELS[g]}</span></span>{g === settings.favoriteGame && <span className={s.favorite} title="Любимая игра" aria-label="Любимая игра">★</span>}</li>)}</ol><p className={s.subtle}>Выбор участника, не текущая активность.</p></section>}
          </aside>}
        </div>}
      </article>
</div>;
}

/** Reusable presentation only; callers own popover behavior and authorization. */
export function ProfileCard({profile, settings, profileHref}: ProfileViewProps & {profileHref: string}) {
 const href=/^\/profile\/[a-zA-Z0-9_-]{1,64}$/.test(profileHref)?profileHref:"/profile";
 return <div className={s.scope} data-profile-customization="true" style={profileStyle(settings)}><article className={s.compact} aria-label="Карточка участника LONDO"><ProfileBanner settings={settings} mini/><div className={s.compactBody}><ProfileAvatar profile={profile} frame={settings.avatarFrame} frameColor={settings.avatarFrameColor}/><h2 style={profileNameStyle(settings.accentColor)}>{profile.displayName}</h2>{profile.username&&<p className={s.subtle}>@{profile.username}</p>}<ProfileBadges badges={settings.selectedBadges}/>{profile.ranks?.map(r=><p className={s.compactRank} key={r}><RankLabel roleId={profile.rankRoleIds?.[r]} colors={profile.rankColors}>{r}</RankLabel></p>)}{!profile.ranks?.length&&profile.families?.map(f=><p key={f}>{f}</p>)}{settings.customStatus&&<p className={s.compactStatus}>{settings.customStatus}</p>}<Link className={s.openProfile} href={href}>Открыть профиль ↗</Link></div></article></div>;
}
