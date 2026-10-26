import Image from "next/image";
import { DiscordLoginButton } from "@/components/discord-login-button";
import s from "./guest-landing.module.css";

function SocialIcon({ kind }: { kind: "telegram" | "discord" }) {
  if (kind === "telegram") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.8 4.4 18.5 20c-.2 1.1-.8 1.4-1.7.9l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.9c.4-.4-.1-.6-.6-.2L6.5 14.1l-4.6-1.4c-1-.3-1-1 .2-1.5L20 4.1c.8-.3 1.6.2 1.8.3Z" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.5 5.1A16.4 16.4 0 0 0 15.4 4l-.5 1a15 15 0 0 0-5.8 0l-.5-1a16.4 16.4 0 0 0-4.1 1.1C1.9 8.5 1.2 11.8 1.5 15a16.5 16.5 0 0 0 5 2.5l1.2-1.7a9.6 9.6 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.7 1.7 11.3 0l.5.4c-.6.4-1.3.7-1.9.9l1.2 1.7a16.5 16.5 0 0 0 5-2.5c.4-3.7-.6-7-2.9-9.9ZM8.5 14.1c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm7 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z" /></svg>;
}

export function GuestLanding() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.brand} aria-label="LONDO">
            <Image src="/branding/londo-logo.png" alt="" width={36} height={36} priority />
            <span>LONDO</span>
          </div>
          <DiscordLoginButton className={s.headerLogin} />
        </div>
      </header>

      <main className={s.hero}>
        <div className={s.copy}>
          <p className={s.eyebrow}>Закрытое пространство сообщества</p>
          <h1>Добро пожаловать в LONDO</h1>
          <p className={s.description}>
            Мы — государственная семья на проекте Majestic RP. Присоединяйся к нам! Мы помогаем новичкам освоиться благодаря активному сообществу опытных игроков. А ещё регулярно проводим розыгрыши денежных призов.
          </p>
          <DiscordLoginButton className={s.mainLogin} />
          <p className={s.note}>После авторизации вам будут доступны разделы согласно вашим правам.</p>
          <nav className={s.socialLinks} aria-label="Социальные сети LONDO">
            <a href="https://t.me/londofam" target="_blank" rel="noreferrer" aria-label="LONDO в Telegram">
              <SocialIcon kind="telegram" />
              <span>Telegram</span>
            </a>
            <a href="https://discord.gg/londo" target="_blank" rel="noreferrer" aria-label="LONDO в Discord">
              <SocialIcon kind="discord" />
              <span>Discord</span>
            </a>
          </nav>
        </div>
        <div className={s.visual} aria-hidden="true">
          <Image
            src="/branding/londo-logo.png"
            alt=""
            fill
            priority
            sizes="(max-width: 700px) 80vw, 520px"
            className={s.heroImage}
          />
        </div>
      </main>
    </div>
  );
}
