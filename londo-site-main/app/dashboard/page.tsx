import {requireFeaturePage} from "@/lib/permissions/guards";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { canAccessFamilySpace } from "@/lib/families/access";
import s from "./dashboard.module.css";

const families = [
  { description: "Открыть панель сервера MEMPHIS", href: "/memphis", logo: "/branding/memphis-server.png", name: "MEMPHIS" },
] as const;

export default async function DashboardPage() {
  const user = await requireFeaturePage("dashboard");

  const visibleFamilies = families.filter(family => canAccessFamilySpace(user, family.name));
  const canChooseFamilies = visibleFamilies.length > 0;

  return (
    <div className="londo-page min-h-screen" data-ui-page="dashboard">
      <Header user={user} />
    <main className={s.main}>
      <section className={s.welcome}>
        <div>
          <p className={s.eyebrow}>Панель рекрута LONDO</p>
          <h1>Рады видеть,<br /><span>{user.displayName || user.username}.</span></h1>
          <p className={s.welcomeText}>{canChooseFamilies ? "Выбери сервер, чтобы продолжить." : "Твои права доступа пока настраиваются. Проверь статус — там будет следующий шаг."}</p>
        </div>
        <Image src="/branding/londo-logo.png" alt="" aria-hidden="true" width={280} height={280} priority sizes="(max-width: 767px) 155px, 250px" className={s.welcomeLogo} />
      </section>

      <section className={s.familySection} aria-labelledby="family-heading">
        <div className={s.sectionHeading}>
          <div><p className={s.eyebrow}>Выбери сервер</p><h2 id="family-heading">Куда направимся?</h2></div>
        </div>
        {canChooseFamilies ? (
          <div className={s.familyList}>
            {visibleFamilies.map((family, index) => (
              <Link key={family.name} href={family.href} className={`${s.familyLink} ${s.memphis}`}>
                <span className={s.familyNumber}>0{index + 1}</span>
                <Image src={family.logo} alt="" width={78} height={78} sizes="78px" className={s.familyLogo} />
                <span className={s.familyDetails}><strong>{family.name}</strong><small>{family.description}</small></span>
                <span className={s.openFamily}>Открыть <span aria-hidden="true">↗</span></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={s.noFamily}>
            <div><h3>Доступ к семьям ещё не настроен</h3><p>Открой раздел доступа, чтобы посмотреть свой статус или запросить права.</p></div>
            <Link href="/access" className={s.actionLink}>Посмотреть статус <span aria-hidden="true">→</span></Link>
          </div>
        )}
      </section>

      <nav className={s.shortcuts} aria-label="Дополнительные разделы">
        <Link href="/access">Доступ и заявки <span aria-hidden="true">↗</span></Link>
        <Link href="/about">О семье LONDO <span aria-hidden="true">↗</span></Link>
        <Link href="/profile">Мой профиль <span aria-hidden="true">↗</span></Link>
      </nav>
    </main>
    </div>
  );
}
