import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { FamilyServerIcon } from "@/components/family-server-icon";
import s from "./about.module.css";

const pillars = [
  { title: "Опыт лидерских сроков", text: "Семья LONDO уже брала лидерки. Этот опыт помогает держать курс и собирать людей вокруг общего дела." },
  { title: "Одна семья — один сервер", text: <><FamilyServerIcon family="MEMPHIS" size="inline" /> LONDO объединяет участников на сервере MEMPHIS.</> },
  { title: "Большой состав", text: "Наш состав имеет большое количество активных участников. Мы всегда рады помочь новым участникам и научить их основам." },
];

const owners = [
  { name: "SENTICEE", discord: "senticee", links: [{ kind: "twitch", label: "Twitch", href: "https://www.twitch.tv/senticee" }, { kind: "youtube", label: "YouTube", href: "https://www.youtube.com/@senticee" }] },
  { name: "Vafelion", discord: "vaflya2101", links: [{ kind: "twitch", label: "Twitch", href: "https://www.twitch.tv/vaflya2121" }] },
  { name: "Ricky", discord: "drago_grow", links: [{ kind: "twitch", label: "Twitch", href: "https://www.twitch.tv/drago_grow" }] },
  { name: "Enrique", discord: "enniozzz", links: [] },
] as const;

function SocialIcon({ kind }: { kind: "twitch" | "youtube" }) {
  if (kind === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.3 2 1 6v15h5v3l3-3h4l7-7V2H4.3Zm14 10.7-4.2 4.2H10l-2.5 2.5v-2.5H4.3V7l1.7-2h12.3v7.7ZM15 8v4h1.7V8H15Zm-4.7 0v4H12V8h-1.7Z" /></svg>;
}

export default async function AboutPage() {
  const user = await getCurrentUser();

  return (
    <main className={`londo-page ${s.page}`}>
        <section className={s.intro}>
          <p className={s.eyebrow}>Знакомство с семьей LONDO</p>
          <h1>Большая семья.<br /><span>Общее дело.</span></h1>
          <p className={s.lead}>LONDO — государственная семья с большим составом, опытом лидерских сроков, медиа-партнерами и адекватными людьми.</p>
          <div className={s.introActions}>
            <Link href={user ? "/apply" : "/api/auth/discord?next=/apply"} className={s.primaryLink}>Подать заявку <span aria-hidden="true">→</span></Link>
            {user ? <Link href="/dashboard" className={s.secondaryLink}>Перейти в личный кабинет</Link> : <Link href="/api/auth/discord?next=/about" className={s.secondaryLink}>Войти через Discord</Link>}
          </div>
          <div className={s.facts} aria-label="LONDO в двух словах">
            <div><span>Формат</span><strong>Государственная семья</strong></div>
            <div><span>Сервер</span><strong className={s.familyNames}><span><FamilyServerIcon family="MEMPHIS" size="inline" /> MEMPHIS</span><i></i></strong></div>
            <div><span>Заявки</span><strong>Открыты для новых людей</strong></div>
          </div>
        </section>

        <section className={s.owners} aria-labelledby="owners-title">
          <div className={s.sectionHeading}>
            <p className={s.eyebrow}>Команда LONDO</p>
            <h2 id="owners-title">Люди, которые ведут семью.</h2>
          </div>
          <div className={s.ownerGrid}>
            {owners.map((owner, index) => (
              <article className={s.ownerCard} key={owner.name}>
                <span className={s.ownerIndex}>{String(index + 1).padStart(2, "0")}</span>
                <span className={s.discordHandle}>Discord · {owner.discord}</span>
                <h3>{owner.name}</h3>
                <p>Овнер LONDO</p>
                <div className={s.socialLinks} aria-label={`Социальные сети ${owner.name}`}>
                  {owner.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer" aria-label={`${link.label} ${owner.name}`} title={link.label}>
                      <SocialIcon kind={link.kind} />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={s.joining} aria-labelledby="joining-title">
          <div className={s.sectionHeading}>
            <p className={s.eyebrow}>Как присоединиться</p>
            <h2 id="joining-title">Три шага до знакомства.</h2>
          </div>
          <div className={s.joinSteps}>
            <article><span>01</span><h3>Выбери сервер</h3><p>Присоединяйся к семье MEMPHIS и играй вместе со своей командой.</p></article>
            <article><span>02</span><h3>Расскажи о себе</h3><p>Заполни анкету и укажи свой игровой никнейм и статик.</p></article>
            <article><span>03</span><h3>Познакомься с семьей</h3><p>Рекрутер свяжется с тобой и пригласит на короткий обзвон.</p></article>
          </div>
        </section>

        <section className={s.families} id="families" aria-labelledby="families-title">
          <div className={s.sectionHeading}>
            <p className={s.eyebrow}>Наш сервер</p>
            <h2 id="families-title">Сервер, на котором мы есть.</h2>
          </div>
          <div className={s.familyRow}>
            <span className={s.familyNumber}>01</span>
            <h3><FamilyServerIcon family="MEMPHIS" /> MEMPHIS</h3>
            <p>Семейная ветка LONDO на сервере MEMPHIS</p>
            <Link href={user ? "/apply?family=MEMPHIS" : "/api/auth/discord?next=/apply"}>Подать заявку на вступление <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className={s.telegram} aria-labelledby="telegram-title">
          <div className={s.telegramMark} aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.8 4.4 18.5 20c-.2 1.1-.8 1.4-1.7.9l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.9c.4-.4-.1-.6-.6-.2L6.5 14.1l-4.6-1.4c-1-.3-1-1 .2-1.5L20 4.1c.8-.3 1.6.2 1.8.3Z" /></svg></div>
          <div><p className={s.eyebrow}>Будь в курсе</p><h2 id="telegram-title">Новости LONDO — в Telegram.</h2><p>Анонсы, новости и важные события семьи в одном канале. Подписывайся, чтобы ничего не пропустить.</p></div>
          <a className={s.telegramLink} href="https://t.me/londofam" target="_blank" rel="noreferrer">Перейти в канал <span aria-hidden="true">↗</span></a>
        </section>

        <section className={s.values} aria-labelledby="values-title">
          <div className={s.sectionHeading}>
            <p className={s.eyebrow}>Что нас объединяет</p>
            <h2 id="values-title">Путь, который мы строим вместе.</h2>
          </div>
          <div className={s.pillars}>
            {pillars.map((pillar, index) => (
              <article className={s.pillar} key={pillar.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{pillar.title}</h3><p>{pillar.text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className={s.closing}>
          <div><p className={s.eyebrow}>Твой следующий шаг</p><h2>Оставляй заявку</h2><p>Будь на Discord-сервере, расскажи о себе в анкете — команда рекрутов поможет дальше.</p></div>
          <Link href={user ? "/apply" : "/api/auth/discord?next=/apply"} className={s.primaryLink}>Написать заявку <span aria-hidden="true">→</span></Link>
        </section>
    </main>
  );
}
