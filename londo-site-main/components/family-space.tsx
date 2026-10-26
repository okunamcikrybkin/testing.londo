import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/header";
import type { SessionUser } from "@/lib/auth/session";
import styles from "./family-space.module.css";
import { canUseFeature } from "@/lib/permissions/features";

type Family = "MEMPHIS";
type FamilySpaceProps = {
  applicationsHref: string;
  family: Family;
  stats: { members: number; onLeave: number };
  user: SessionUser;
};

const sections = [
  { title: "Заявки", description: "Новые кандидаты и этапы рассмотрения", category: "ПРИЁМ В СЕМЬЮ", href: "applications", icon: "applications" },
  { title: "Состав", description: "Участники, ранги и активность семьи", category: "УЧАСТНИКИ", href: "roster", icon: "roster" },
  { title: "Отпуск", description: "Заявки и текущие периоды отсутствия", category: "УЧАСТНИКИ", href: "afk", icon: "leave" },
  { title: "Повышения", description: "Заявки на следующий ранг и должности", category: "РАЗВИТИЕ", href: "promotions", icon: "promotions" },
] as const;

function SectionIcon({ name }: { name: "applications" | "roster" | "leave" | "promotions" | "statistics" }) {
  const paths = {
    applications: <><path d="M8 3.75h6l4 4V20a.75.75 0 0 1-.75.75h-9.5A.75.75 0 0 1 7 20V4.5a.75.75 0 0 1 .75-.75Z"/><path d="M14 4v4h4M10 12h5M10 15.5h5"/></>,
    roster: <><circle cx="9" cy="8" r="3"/><path d="M3.75 19v-1.25A4.75 4.75 0 0 1 8.5 13h1a4.75 4.75 0 0 1 4.75 4.75V19M16 5.5a3 3 0 0 1 0 5.75M17 14a4.5 4.5 0 0 1 3.25 4.25V19"/></>,
    leave: <><path d="M12 3.5v8.75l5.25 3.25"/><circle cx="12" cy="12" r="8.5"/></>,
    promotions: <><path d="m4 17 5-5 3 3 7-8"/><path d="M14.5 7H19v4.5"/><path d="M4 20h16"/></>,
    statistics: <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/><path d="M16 6h4v4"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function FamilySpace({ applicationsHref, family, stats, user }: FamilySpaceProps) {
  const visibleSections = canUseFeature(user.effectiveAccess, "recruitStatistics")
    ? [...sections, { title: "Статистика рекрутов", description: "Вклад рекрутов, обработанные заявки и общий лидерборд.", category: "КОМАНДА", href: "recruit-statistics", icon: "statistics" as const }]
    : sections;
  return (
    <div className="londo-page min-h-screen" data-ui-page="family-space" data-family={family.toLowerCase()}>
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className={styles.topbar}>
          <Link href="/dashboard" className="londo-ui-button"><span aria-hidden="true">←</span> Панель рекрута</Link>
          <span className="londo-ui-eyebrow">Пространство семьи</span>
        </div>

        <section className={`londo-ui-surface ${styles.shell}`} aria-labelledby="family-title">
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className="londo-ui-eyebrow">ПАНЕЛЬ СЕРВЕРА</p>
              <h1 className="sr-only" id="family-title">{family}</h1>
              <p className="londo-ui-description">Управляйте составом, заявками и развитием семьи из одного пространства.</p>
            </div>
            <div className={styles.familyMark} data-family={family} aria-label={`Сервер ${family}`}>
              <Image
                src={`/branding/${family.toLowerCase()}-server.png`}
                alt={`Логотип ${family}`}
                width={64}
                height={64}
                className={styles.familyLogo}
                priority
              />
              <div className={styles.familyLabel}>
              <span>СЕРВЕР</span><strong>{family}</strong>
              </div>
            </div>
          </header>

          <div className={styles.stats} aria-label="Сводка по семье">
            <div className={styles.stat}><span>Участники</span><strong>{stats.members}</strong><small>в составе семьи</small></div>
            <div className={styles.stat}><span>В отпуске</span><strong>{stats.onLeave}</strong><small>активных периодов</small></div>
            <div className={styles.stat}><span>Разделы</span><strong>{String(visibleSections.length).padStart(2, "0")}</strong><small>для управления семьёй</small></div>
          </div>

          <div className={styles.sectionHeading}>
            <div><h2>Разделы управления</h2><p>Выберите нужное направление</p></div>
            <span className={styles.sectionCount}>01 — {String(visibleSections.length).padStart(2, "0")}</span>
          </div>

          <nav className={styles.sectionGrid} aria-label={`Разделы семьи ${family}`}>
            {visibleSections.map((section, index) => (
              <Link key={section.href} href={section.href === "applications" ? applicationsHref : section.href === "recruit-statistics" ? "/recruit-statistics" : `/${family.toLowerCase()}/${section.href}`} className={`londo-ui-surface ${styles.sectionCard}`}>
                <div className={styles.cardTop}><span className={styles.cardIcon}><SectionIcon name={section.icon} /></span><span className={styles.cardIndex}>0{index + 1}</span></div>
                <span className={styles.cardCategory}>{section.category}</span>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <span className={styles.cardAction}>Открыть раздел <span aria-hidden="true">→</span></span>
              </Link>
            ))}
          </nav>
        </section>
      </main>
    </div>
  );
}
