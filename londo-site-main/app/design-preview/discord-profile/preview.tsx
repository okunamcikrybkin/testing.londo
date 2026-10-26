"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { FRAMES, GAME_LABELS, profileUrl, type ProfileData, type ProfileSettings } from "@/lib/profile-customization/settings";
import { PROFILE_COLORS } from "@/components/profile/profile-view";
import { demoProfile, SCENARIOS, type Scenario } from "./demo";
import s from "./preview.module.css";

const familyArt: Record<string, string> = { MEMPHIS: "/branding/memphis-server.png", PHOENIX: "/branding/phoenix-server.png" };
function safeUrl(value: string | null, banner = false) { try { return value ? profileUrl(value, banner) : null; } catch { return null; } }

function Banner({ settings, mini = false }: { settings: ProfileSettings; mini?: boolean }) {
  const custom = safeUrl(settings.customBannerUrl, true);
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={s.banner} data-mini={mini} data-preset={settings.bannerPreset}>
    {custom && custom !== failed ? <Image src={custom} alt="" fill unoptimized referrerPolicy="no-referrer" onError={() => setFailed(custom)} sizes="(max-width: 768px) 100vw, 1240px" /> : <>
      <div className={s.bannerType} aria-hidden="true">LONDO</div>
      {settings.bannerPreset !== "NONE" && <Image className={s.bannerArt} src="/branding/londo-logo.png" alt="" width={600} height={600} priority={!mini} />}
    </>}
    {!mini && <div className={s.bannerCaption}><span>THE PEOPLE MAKE THE FAMILY.</span><span>LOS SANTOS / LONDO</span></div>}
  </div>;
}

function Avatar({ profile, frame, small = false }: { profile: ProfileData; frame: ProfileSettings["avatarFrame"]; small?: boolean }) {
  const url = safeUrl(profile.avatarUrl);
  const [failed, setFailed] = useState(false);
  return <span className={s.avatar} data-frame={frame} data-small={small}>{url && !failed ? <Image src={url} alt="" width={144} height={144} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span aria-hidden="true">{profile.displayName.slice(0, 1)}</span>}</span>;
}

function Badges({ badges }: { badges: string[] }) {
  return <div className={s.badges} aria-label="Бейджи участника">{badges.map(b => <span key={b} className={s.badge} tabIndex={0} data-badge={b} aria-label={`Бейдж ${b}`}>
    {familyArt[b] ? <Image src={familyArt[b]} alt="" width={22} height={22} /> : <span className={s.badgeSymbol} aria-hidden="true">{b === "MAIN" ? "✦" : b === "OWNER" ? "♜" : "L"}</span>}
    <span>{b === "LND" ? "LONDO" : b}</span><span className={s.tooltip}>{b === "LND" ? "Участник семьи LONDO" : b === "MAIN" ? "Основной ранг · Main" : b}</span>
  </span>)}</div>;
}

export default function Preview() {
  const [scenario, setScenario] = useState<Scenario>("MEMPHIS");
  const [owner, setOwner] = useState(false);
  const [frame, setFrame] = useState<ProfileSettings["avatarFrame"] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const { profile, settings: original } = demoProfile(scenario, owner);
  const settings = { ...original, avatarFrame: frame ?? original.avatarFrame };
  const accent = PROFILE_COLORS[settings.accentColor === "THEME" ? settings.theme : settings.accentColor];
  const families = profile.families ?? [];
  const hasDetails = Boolean(settings.bio || settings.links.length || settings.games.length || families.length || profile.ranks?.length || profile.coins || profile.voiceTime || owner);
  function openCard() { dialog.current?.showModal(); }
  function closeCard() { dialog.current?.close(); }

  return <div className={s.page} style={{ "--p-accent": accent } as CSSProperties}>
    <header className={s.siteHeader}><Link href="/" className={s.wordmark}><Image src="/branding/londo-logo.png" alt="" width={36} height={36} />LONDO<span>FAMILY SPACE</span></Link><span className={s.headerLabel}>Люди, с которыми ты дома.</span><Link href="/">На главную ↗</Link></header>
    <main className={s.container}>
      <div className={s.previewBar}><div><span className={s.eyebrow}>DESIGN STUDY / 04</span><p>Демо-профиль · изменения не сохраняются</p></div><div className={s.controls}>
        <label><span className={s.srOnly}>Демонстрационный профиль</span><select value={scenario} onChange={e => { setScenario(e.target.value as Scenario); setFrame(null); }}>{Object.entries(SCENARIOS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <div className={s.viewSwitch} aria-label="Режим просмотра"><button aria-pressed={!owner} onClick={() => setOwner(false)}>Посетитель</button><button aria-pressed={owner} onClick={() => setOwner(true)}>Владелец</button></div>
      </div></div>

      <article className={s.profile} id="full-profile" aria-label="Демонстрационный профиль LONDO">
        <Banner settings={settings} />
        <div className={s.identity}>
          <button className={s.avatarButton} onClick={openCard} aria-label={`Открыть компактную карточку ${profile.displayName}`} aria-haspopup="dialog"><Avatar profile={profile} frame={settings.avatarFrame} /></button>
          <div className={s.identityTop}><span className={s.eyebrow}>LONDO / ЛИЧНОЕ ПРОСТРАНСТВО</span>{owner ? <Link className={s.editButton} href="/profile/customize">Настроить профиль ↗</Link> : <button className={s.cardButton} onClick={openCard} aria-haspopup="dialog">Карточка участника ↗</button>}</div>
          <div className={s.identityRow}><div><h1>{profile.displayName}</h1><div className={s.handles}>{profile.username && <span>@{profile.username}</span>}{profile.gameNickname && <span>{profile.gameNickname}</span>}{profile.staticId && <span>Static #{profile.staticId}</span>}</div></div><Badges badges={settings.selectedBadges} /></div>
          {settings.customStatus && <p className={s.status}><span aria-hidden="true">“</span>{settings.customStatus}<small>Личный статус</small></p>}
        </div>

        {hasDetails && <div className={s.body}>
          <div className={s.mainColumn}>
            {settings.bio ? <section className={s.about}><h2>За ником — человек.</h2><p className={s.eyebrow}>О СЕБЕ</p><p className={s.bio}>{settings.bio}</p></section> : owner && <section className={s.about}><h2>Твоя история начинается здесь.</h2><Link className={s.textLink} href="/profile/customize">Добавить информацию о себе ↗</Link></section>}
            {(families.length > 0 || Boolean(profile.ranks?.length)) && <section className={s.familySection}><h2 className={s.sectionTitle}>Место в семье <span>LONDO COMMUNITY</span></h2>
              {families.map(f => <div key={f} className={s.family} data-family={f}><Image src={familyArt[f]} alt="" width={52} height={52} /><div><span className={s.micro}>СЕМЬЯ</span><h3>{f}</h3></div>{profile.ranks?.filter(r => r.startsWith(`${f} · `)).map(r => <div className={s.rank} key={r}><span className={s.micro}>РАНГ</span><strong>{r.split(" · ").slice(1).join(" · ")}</strong></div>)}</div>)}
              {!families.length && profile.ranks?.map(r => <p key={r}>{r}</p>)}
              <div className={s.roles}><span className={s.micro}>РОЛИ</span>{families.length > 0 && <span>LONDO</span>}{families.map(f => <span key={f} data-family={f}>{f}</span>)}{profile.ranks?.map(r => <span key={r}>{r}</span>)}</div>
            </section>}
            {(profile.voiceTime !== undefined || profile.coins !== undefined) && <dl className={s.stats}>{profile.voiceTime !== undefined && <div><dt>В ГОЛОСОВЫХ</dt><dd>{profile.voiceTime}</dd><span>Время вместе</span></div>}{profile.coins !== undefined && <div><dt>LONDO COINS</dt><dd>{profile.coins}<small>LC</small></dd><span>Баланс участника</span></div>}</dl>}
          </div>
          {(settings.links.length > 0 || settings.games.length > 0 || owner) && <aside className={s.sideColumn}>
            {settings.links.length > 0 && <section><h2 className={s.sectionTitle}>Вне города <span>СВЯЗИ</span></h2><div className={s.connections}>{settings.links.slice().sort((a,b) => a.sortOrder-b.sortOrder).map(l => { const url = safeUrl(l.url); return url && <a key={l.type} href={url} target="_blank" rel="noopener noreferrer nofollow ugc"><span className={s.connectionIcon} aria-hidden="true">{l.type === "TWITCH" ? "↳" : l.type === "TELEGRAM" ? "↗" : "▷"}</span><span><small>{l.type}</small><strong>{l.label}</strong></span><span aria-hidden="true">↗</span></a>; })}</div></section>}
            {settings.games.length > 0 && <section className={s.gamesSection}><h2 className={s.sectionTitle}>В моей коллекции <span>ИГРЫ</span></h2><ol className={s.games}>{settings.games.map((g,i) => <li key={g}><span className={s.gameNumber}>{String(i+1).padStart(2,"0")}</span><span>{GAME_LABELS[g]}</span>{g === settings.favoriteGame && <span className={s.favorite} title="Любимая игра" aria-label="Любимая игра">★</span>}</li>)}</ol><p className={s.subtle}>Выбор участника, не текущая активность.</p></section>}
            {owner && <section className={s.ownerNote}><span className={s.micro}>ТОЛЬКО ВЛАДЕЛЬЦУ · ДЕМО</span><p>Discord ID <span>{profile.discordId}</span></p><p>Static ID <span>{profile.staticId ?? "Не указан"}</span></p><small>В режиме посетителя скрытые поля отсутствуют.</small></section>}
          </aside>}
        </div>}
        <div className={s.profileFooter}><span className={s.footerMark}>L.</span><span>Не просто ник в списке.<br/><strong>Часть LONDO.</strong></span><span>MEMBERS MAKE IT HOME</span></div>
      </article>
      <section className={s.specimen}><div><span className={s.eyebrow}>МАЛЕНЬКИЙ ФОРМАТ / ТА ЖЕ ЛИЧНОСТЬ</span><p>Так профиль может открываться из списка участников.</p></div><button className={s.rosterButton} onClick={openCard} aria-haspopup="dialog"><Avatar profile={profile} frame={settings.avatarFrame} small /><span>{profile.displayName}<small>Открыть карточку</small></span><span>↗</span></button></section>
      <footer className={s.notes}><p>Изолированный концепт. Все имена, показатели и ссылки — демо.<br/>Аватар с инициалом — fallback; личный статус не означает присутствие в Discord.</p><label>Рамка аватара<select aria-label="Рамка аватара" value={settings.avatarFrame} onChange={e => setFrame(e.target.value as ProfileSettings["avatarFrame"])}>{FRAMES.map(f => <option key={f}>{f}</option>)}</select></label></footer>
    </main>
    <dialog ref={dialog} className={s.dialog} aria-labelledby="compact-name" onClick={e => { if(e.target === e.currentTarget) closeCard(); }}>
      <div className={s.compact}><Banner settings={settings} mini /><button className={s.close} onClick={closeCard} aria-label="Закрыть карточку" autoFocus>×</button><div className={s.compactBody}><Avatar profile={profile} frame={settings.avatarFrame} /><h2 id="compact-name">{profile.displayName}</h2>{profile.username && <p className={s.subtle}>@{profile.username}</p>}<Badges badges={settings.selectedBadges} />{profile.ranks?.map(r => <p className={s.compactRank} key={r}>{r}</p>)}{!profile.ranks?.length && families.map(f => <p key={f}>{f}</p>)}{settings.customStatus && <p className={s.compactStatus}>{settings.customStatus}</p>}<a className={s.openProfile} href="#full-profile" onClick={closeCard}>Открыть профиль ↗</a></div></div>
    </dialog>
  </div>;
}
