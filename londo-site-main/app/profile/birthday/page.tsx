import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { birthdayTodayIso, safeBirthdayReturnPath } from "@/lib/profile/birthday";
import { saveBirthday } from "./actions";

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export const dynamic = "force-dynamic";

export default async function BirthdayPage({ searchParams }: Props) {
  const user = await getCurrentUser({ allowIncompleteBirthday: true });
  if (!user) redirect("/");
  const query = await searchParams;
  const next = safeBirthdayReturnPath(query.next);
  if (user.birthdayMonth !== null && user.birthdayDay !== null && user.birthdayYear !== null) redirect(next);

  return <div className="londo-page min-h-screen"><Header user={user} /><main className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 sm:py-16">
    <section className="londo-card rounded-3xl p-6 sm:p-9">
      <p className="londo-eyebrow">Настройка профиля</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Когда у тебя день рождения?</h1>
      <p className="mt-4 text-sm leading-7 text-muted">Укажи дату рождения, чтобы бот поздравил тебя в Discord и выдал праздничную роль. Дата появится в твоём профиле и составе семьи.</p>
      {query.error === "invalid" && <p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">Проверь дату и попробуй ещё раз.</p>}
      <form action={saveBirthday} className="mt-7 grid gap-5">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-2 text-sm font-medium text-white" htmlFor="birthday">Дата рождения
          <input id="birthday" name="birthday" type="date" lang="ru-RU" autoComplete="bday" max={birthdayTodayIso()} required className="min-h-12 rounded-xl border border-white/15 bg-black/25 px-4 text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        </label>
        <p className="-mt-3 text-xs text-muted">Формат даты: ДД.ММ.ГГГГ. Можно выбрать день в календаре.</p>
        <button type="submit" className="londo-button min-h-12 px-5">Сохранить дату</button>
      </form>
    </section>
  </main></div>;
}
