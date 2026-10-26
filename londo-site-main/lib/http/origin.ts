export function configuredPublicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? new URL(configured).origin : new URL(request.url).origin;
}

export function sameSiteOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === configuredPublicOrigin(request));
}
