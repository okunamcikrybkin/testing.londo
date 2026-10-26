export function logInfo(message: string): void {
  console.info(`[LONDO Bot] ${message}`);
}

export function logError(message: string): void {
  console.error(`[LONDO Bot] ${message}`);
}

export function logWarning(message: string): void {
  console.warn(`[LONDO Bot] ${message}`);
}

export function describeDiscordError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;

    if (code === 50001) return "Discord API error: Missing Access (50001).";
    if (code === 50013) return "Discord API error: Missing Permissions (50013).";
    if (code === 401) return "Discord API error: Unauthorized (401).";
    if (typeof code === "number" || typeof code === "string") return `Discord API error: code ${code}.`;
  }

  if (error instanceof Error) {
    return `Discord connection error: ${error.name}.`;
  }

  return "Discord connection error.";
}
