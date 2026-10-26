export function configuredPublicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? new URL(configured).origin : new URL(request.url).origin;
}

export function sameSiteOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const originUrl = new URL(origin);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host");
  if (requestHost && originUrl.host === requestHost) return true;
  return originUrl.origin === configuredPublicOrigin(request);
}
