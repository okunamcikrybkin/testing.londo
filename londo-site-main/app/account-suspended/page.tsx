import Link from "next/link";

export default function AccountSuspendedPage() {
  return (
    <main className="londo-page flex min-h-screen items-center justify-center px-4">
      <section className="londo-card w-full max-w-lg rounded-[2rem] border-amber-200/15 p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-200">LONDO</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Аккаунт приостановлен</h1>
        <p className="mt-3 leading-7 text-muted">Вход в аккаунт временно ограничен. Свяжитесь с администрацией, если считаете это ошибкой.</p>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15">На главную</Link>
      </section>
    </main>
  );
}
