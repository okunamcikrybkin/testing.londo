type DiscordLoginButtonProps = {
  className?: string;
  compact?: boolean;
};

export function DiscordLoginButton({
  className = "",
  compact = false,
}: DiscordLoginButtonProps) {
  return (
    <a
      href="/api/auth/discord"
      className={`londo-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M19.27 5.33A16.6 16.6 0 0 0 15.13 4c-.18.32-.4.75-.54 1.1a15.3 15.3 0 0 0-5.18 0A10.3 10.3 0 0 0 8.86 4a16.5 16.5 0 0 0-4.14 1.34C1.84 9.05 1.2 12.66 1.52 16.22A16.7 16.7 0 0 0 6.6 18.7c.36-.5.68-1.03.96-1.58a10.7 10.7 0 0 1-1.51-.73c.13-.1.25-.2.37-.3a11.9 11.9 0 0 0 10.16 0c.12.11.24.21.37.3-.48.29-.99.53-1.52.74.28.55.6 1.08.96 1.57a16.6 16.6 0 0 0 5.08-2.47c.4-4.17-.67-7.75-2.56-10.9ZM8.52 13.98c-.95 0-1.73-.88-1.73-1.96s.76-1.96 1.73-1.96 1.75.88 1.73 1.96-.76 1.96-1.73 1.96Zm6.96 0c-.95 0-1.73-.88-1.73-1.96s.76-1.96 1.73-1.96 1.75.88 1.73 1.96-.76 1.96-1.73 1.96Z" />
      </svg>
      <span>{compact ? "Войти" : "Войти через Discord"}</span>
    </a>
  );
}
