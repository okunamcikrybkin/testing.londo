import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { familySettingsForAccess, type Feature } from "@/lib/permissions/features";

const descriptions: Partial<Record<Feature, string>> = {
  accessManagement: "Проверяйте заявки на доступ и управляйте действующими правами.",
  promotionSettings: "Настройте ранги, критерии и формы заявок на повышение.",
  rouletteAdmin: "Настраивайте призы, правила и результаты колеса.",
  notifications: "Настройте, какие события и куда отправляет Discord-бот.",
  factionRoles: "Управляйте панелью ролей для участников в Discord.",
  rankColors: "Настройте отображение цветов рангов на сайте.",
  discordChecks: "Посмотрите результаты проверок Discord-аккаунтов.",
  giveaways: "Создавайте розыгрыши и следите за их проведением.",
  shopManage: "Редактируйте товары, покупки и выдачу наград.",
  economy: "Проверяйте баланс и историю монет участников.",
  recruitStatistics: "Смотрите вклад рекрутов, типы обработанных заявок и общий лидерборд.",
};

const groups: { title: string; features: Feature[] }[] = [
  { title: "Управление сообществом", features: ["accessManagement", "rouletteAdmin", "promotionSettings", "giveaways", "shopManage"] },
  { title: "Настройки и участники", features: ["notifications", "factionRoles", "rankColors", "discordChecks", "economy"] },
];
const sectionCount = new Intl.PluralRules("ru-RU");
const sectionWord = (count: number) => ["раздел", "раздела", "разделов"][sectionCount.select(count) === "one" ? 0 : sectionCount.select(count) === "few" ? 1 : 2];

const featureIcons: Record<Feature, ReactNode> = {
  accessManagement: <><path d="M12 3 5 6v5c0 4.5 2.9 8.2 7 10 4.1-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  rouletteAdmin: <><circle cx="12" cy="12" r="9"/><path d="m12 3 2.7 6.1L21 12l-6.3 2.9L12 21l-2.7-6.1L3 12l6.3-2.9L12 3Z"/><circle cx="12" cy="12" r="2"/></>,
  promotionSettings: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
  notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  factionRoles: <><path d="M12 3 4 7v5c0 4.4 3.2 7.8 8 9 4.8-1.2 8-4.6 8-9V7l-8-4Z"/><path d="M12 8v8M8 12h8"/></>,
  rankColors: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/><path d="M4 21h16"/></>,
  discordChecks: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  giveaways: <><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5V7Zm0 0h4.5a2.5 2.5 0 1 0-2.5-2.5V7Z"/></>,
  shopManage: <><path d="M3 9h18l-1.5 12h-15L3 9Z"/><path d="M7 9a5 5 0 0 1 10 0M9 13v.1M15 13v.1"/></>,
  economy: <><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.7-.7-1.8-1-3.1-1-1.8 0-3 .8-3 2s1.1 1.8 3 2.2 3 .9 3 2.3-1.2 2.5-3.2 2.5c-1.4 0-2.7-.5-3.6-1.4M12 5.5v13"/></>,
  recruitStatistics: <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/><path d="M16 6h4v4"/></>,
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const available = familySettingsForAccess(user.effectiveAccess);
  if (!available.length) redirect("/access-denied");

  return (
    <div className="londo-page min-h-screen">
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-white">
          <span aria-hidden="true">←</span> Панель рекрута
        </Link>
        <div className="mt-8 max-w-3xl">
          <p className="londo-eyebrow">Рабочее пространство</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Панель администратора</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Выберите, чем хотите заняться. В каждом разделе есть пояснения и ссылка, чтобы вернуться сюда.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {groups.map((group) => {
            const items = available.filter((item) => group.features.includes(item.feature));
            if (!items.length) return null;
            return (
              <section key={group.title} aria-labelledby={`admin-group-${group.features[0]}`}>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <h2 id={`admin-group-${group.features[0]}`} className="text-xl font-semibold text-white">{group.title}</h2>
                  <span className="text-sm text-muted">{items.length} {sectionWord(items.length)}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                  {items.map((item, index) => (
                    <Link
                      key={item.feature}
                      href={item.href}
                      className="londo-card group flex min-h-40 flex-col justify-between rounded-3xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium tracking-[.14em] text-muted">{String(index + 1).padStart(2, "0")}</span>
                          <div className="flex items-center gap-3">
                            <span className="grid size-10 place-items-center rounded-2xl border border-[#e6b77a]/20 bg-[#e6b77a]/[.08] text-[#e6b77a] shadow-[inset_0_1px_0_#ffffff12] transition duration-200 group-hover:border-[#e6b77a]/40 group-hover:bg-[#e6b77a]/[.13] group-hover:shadow-[0_0_24px_#e6b77a1c]" aria-hidden="true">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5">{featureIcons[item.feature]}</svg>
                            </span>
                            <span className="text-lg text-muted transition group-hover:translate-x-1 group-hover:text-white" aria-hidden="true">↗</span>
                          </div>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">{item.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted">{descriptions[item.feature]}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
