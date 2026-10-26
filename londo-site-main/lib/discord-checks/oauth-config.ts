export class ConsentConfigurationError extends Error {
 readonly code = "CONSENT_NOT_CONFIGURED";
 constructor(message: string) { super(message); }
}
export function requireConsentConfiguration(env: Record<string, string | undefined>) {
 const missing = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_OAUTH_ENCRYPTION_KEY"].filter(name => !env[name]?.trim());
 if (missing.length) throw new ConsentConfigurationError(`Проверка Discord недоступна: администратору нужно настроить ${missing.join(", ")}. После настройки повторите попытку.`);
 if (!/^[a-fA-F0-9]{64}$/.test(env.DISCORD_OAUTH_ENCRYPTION_KEY!)) throw new ConsentConfigurationError("Проверка Discord недоступна: неверный формат DISCORD_OAUTH_ENCRYPTION_KEY. Администратору нужно указать ключ из 64 шестнадцатеричных символов. После настройки повторите попытку.");
}
