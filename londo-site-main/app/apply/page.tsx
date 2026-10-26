import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { ApplyForm } from "@/components/discord-checks/apply-form";
import s from "@/components/discord-checks/ui.module.css";

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ consent?: string; family?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;

  return (
    <div className="londo-page min-h-screen">
      <Header user={user} />
      <main className={s.page}>
        <header className={s.pageIntro}>
          <div>
            <p className={s.pageEyebrow}>LONDO · Заявка</p>
            <h1 className={s.title}>Давай знакомиться.</h1>
            <p className={s.introText}>Пять коротких шагов: подтвердить участие в Memphis и рассказать немного о себе. Особые роли в Discord не нужны.</p>
          </div>
          <Link href="/about" className={s.aboutLink}>Познакомиться с LONDO <span aria-hidden="true">↗</span></Link>
        </header>
        {user ? (
          <>
            <section className={s.accountStrip} aria-label="Вы вошли через Discord">
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={44} height={44} className={s.accountAvatar} /> : <span className={s.accountAvatarFallback}>{user.displayName.slice(0, 1).toUpperCase()}</span>}
              <div className={s.accountDetails}>
                <span className={s.accountName}>{user.displayName}</span>
                <span className={s.accountHandle}>@{user.username}</span>
              </div>
              <span className={s.accountConnected}><span aria-hidden="true">✓</span> Discord подключён</span>
            </section>
            <ApplyForm consentResult={params.consent ?? ""} initialFamily={params.family === "MEMPHIS" ? params.family : ""} />
          </>
        ) : (
          <section className={s.signInPanel}>
            <span className={s.signInMark} aria-hidden="true">↗</span>
            <div><h2>Сначала подключи Discord</h2><p>Мы проверим только, что ты уже состоишь на сервере LONDO. Роли и дополнительные права не нужны.</p></div>
            <a className={s.signInButton} href="/api/auth/discord?next=/apply">
              Продолжить через Discord <span aria-hidden="true">→</span>
            </a>
            <p className={s.signInFootnote}>Авторизация безопасна: сайт не получает твой пароль от Discord.</p>
          </section>
        )}
      </main>
    </div>
  );
}
