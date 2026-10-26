import { DiscordLoginButton } from "@/components/discord-login-button";

const messages: Record<string, { title: string; text: string }> = {
  authentication_failed: {
    title: "Не удалось завершить вход",
    text: "Discord или сервер не подтвердили вход. Попробуйте ещё раз позже.",
  },
  configuration: {
    title: "Вход временно недоступен",
    text: "Авторизация Discord ещё не настроена для этого окружения.",
  },
  invalid_state: {
    title: "Проверка входа не пройдена",
    text: "Запрос устарел или не соответствует начатому входу. Начните заново.",
  },
  missing_code: {
    title: "Discord не вернул код входа",
    text: "Авторизация была отменена или завершилась некорректно. Попробуйте ещё раз.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = messages[reason ?? ""] ?? messages.authentication_failed;

  return (
    <main className="londo-page flex min-h-screen items-center justify-center px-4">
      <section className="londo-card w-full max-w-lg rounded-[2rem] p-8 text-center shadow-2xl">
        <p className="londo-eyebrow">LONDO</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{message.title}</h1>
        <p className="mt-3 leading-7 text-muted">{message.text}</p>
        <div className="mt-8 flex justify-center"><DiscordLoginButton /></div>
      </section>
    </main>
  );
}
