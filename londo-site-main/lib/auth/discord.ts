import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { syncAccessOnLogin } from "@/lib/access/sync";
import { getEffectiveAccess } from "@/lib/permissions/rbac";
import { discordAvatarUrl } from "@/lib/discord/identity";
import { formatDiscordAuthorization } from "@/lib/discord-checks/discord-api";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_CURRENT_USER_URL = "https://discord.com/api/users/@me";

export const OAUTH_STATE_COOKIE = "atemii_discord_oauth_state";
export const SESSION_COOKIE = "atemii_session";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type DiscordProfile = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction(),
  };
}

function getConfiguredAppOrigin(request: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    return request.nextUrl.origin;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("Invalid application URL configuration");
  }

  if (
    parsedUrl.protocol !== "https:" &&
    !(parsedUrl.protocol === "http:" && parsedUrl.hostname === "localhost")
  ) {
    throw new Error("Invalid application URL protocol");
  }

  return parsedUrl.origin;
}

function getDiscordCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Discord OAuth is not configured");
  }

  return { clientId, clientSecret };
}

function createOauthState(): string {
  return randomBytes(32).toString("base64url");
}

function isMatchingOauthState(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionCookieOptions() {
  return getCookieOptions(SESSION_MAX_AGE_SECONDS);
}

function redirectToAuthError(request: NextRequest, reason: string): NextResponse {
  let origin = request.nextUrl.origin;
  try { origin = getConfiguredAppOrigin(request); } catch { /* keep request origin for a configuration error */ }
  const response = NextResponse.redirect(
    new URL(`/auth/error?reason=${encodeURIComponent(reason)}`, origin),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...getCookieOptions(0), maxAge: 0 });
  return response;
}

function parseDiscordProfile(payload: unknown): DiscordProfile | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const profile = payload as Record<string, unknown>;
  if (typeof profile.id !== "string" || typeof profile.username !== "string") {
    return null;
  }

  return {
    id: profile.id,
    username: profile.username,
    global_name: typeof profile.global_name === "string" ? profile.global_name : null,
    avatar: typeof profile.avatar === "string" ? profile.avatar : null,
  };
}

async function requestDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  const response = await fetch(DISCORD_CURRENT_USER_URL, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Discord profile request failed");
  }

  const profile = parseDiscordProfile(await response.json());
  if (!profile) {
    throw new Error("Discord returned an invalid profile");
  }

  return profile;
}

async function exchangeDiscordCode(
  code: string,
  callbackUrl: string,
): Promise<string> {
  const { clientId, clientSecret } = getDiscordCredentials();
  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    throw new Error("Discord token exchange failed");
  }

  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Discord returned an invalid token response");
  }

  return payload.access_token;
}

export function handleDiscordSignInRequest(request: NextRequest): NextResponse {
  try {
    const { clientId } = getDiscordCredentials();
    const state = createOauthState();
    const callbackUrl = new URL(
      "/api/auth/discord/callback",
      getConfiguredAppOrigin(request),
    ).toString();
    const authorizeUrl = new URL(DISCORD_AUTHORIZE_URL);

    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "identify");
    authorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set("londo_login_next", request.nextUrl.searchParams.get("next") === "/apply" ? "/apply" : "", getCookieOptions(OAUTH_STATE_MAX_AGE_SECONDS));
    response.cookies.set(
      OAUTH_STATE_COOKIE,
      state,
      getCookieOptions(OAUTH_STATE_MAX_AGE_SECONDS),
    );
    return response;
  } catch {
    return redirectToAuthError(request, "configuration");
  }
}

export async function handleDiscordCallbackRequest(
  request: NextRequest,
): Promise<NextResponse> {
  if (request.nextUrl.searchParams.get("state")?.startsWith("check.")) {
    const { finishCheckConsent } = await import("@/lib/discord-checks/oauth");
    return finishCheckConsent(request);
  }
  const code = request.nextUrl.searchParams.get("code");
  const receivedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code) {
    return redirectToAuthError(request, "missing_code");
  }

  if (
    !receivedState ||
    !expectedState ||
    !isMatchingOauthState(expectedState, receivedState)
  ) {
    return redirectToAuthError(request, "invalid_state");
  }

  try {
    const appOrigin = getConfiguredAppOrigin(request);
    const callbackUrl = new URL(
      "/api/auth/discord/callback",
      appOrigin,
    ).toString();
    const accessToken = await exchangeDiscordCode(code, callbackUrl);
    const discordProfile = await requestDiscordProfile(accessToken);
    const now = new Date();
    const user = await prisma.user.upsert({
      where: { discordId: discordProfile.id },
      create: {
        avatar: discordAvatarUrl(discordProfile.id, discordProfile.avatar),
        discordId: discordProfile.id,
        displayName: discordProfile.global_name ?? discordProfile.username,
        lastLoginAt: now,
        username: discordProfile.username,
      },
      update: {
        avatar: discordAvatarUrl(discordProfile.id, discordProfile.avatar),
        displayName: discordProfile.global_name ?? discordProfile.username,
        lastLoginAt: now,
        username: discordProfile.username,
      },
    });

    // Login is a best-effort first sync; gateway and reconciliation maintain it afterwards.
    await syncAccessOnLogin(discordProfile.id);

    if (user.status === "SUSPENDED") {
      const response = NextResponse.redirect(
        new URL("/account-suspended", appOrigin),
      );
      response.cookies.set(OAUTH_STATE_COOKIE, "", { ...getCookieOptions(0), maxAge: 0 });
      return response;
    }

    if (user.status === "BANNED") {
      const response = NextResponse.redirect(
        new URL("/account-banned", appOrigin),
      );
      response.cookies.set(OAUTH_STATE_COOKIE, "", { ...getCookieOptions(0), maxAge: 0 });
      return response;
    }

    const sessionToken = createSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

    await prisma.$transaction([
      prisma.session.create({
        data: {
          expiresAt,
          tokenHash: hashSessionToken(sessionToken),
          userId: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "USER_LOGIN",
          actorId: user.id,
          targetId: user.id,
          targetType: "User",
        },
      }),
    ]);

    const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { staffAccessGrants: { where: { revokedAt: null } }, staffAccessCredential: { select: { pinSetAt: true } } } });
    const postLoginDestination = request.cookies.get("londo_login_next")?.value === "/apply" ? "/apply" : getEffectiveAccess(current) !== "FULL_ACCESS" && current.staffAccessGrants.length
      ? `/access/pin/${current.staffAccessCredential?.pinSetAt ? "verify" : "setup"}` : "/";
    const destination = current.birthdayMonth === null || current.birthdayDay === null || current.birthdayYear === null
      ? `/profile/birthday?next=${encodeURIComponent(postLoginDestination)}`
      : postLoginDestination;
    const response = NextResponse.redirect(new URL(destination, appOrigin));
    response.cookies.set(SESSION_COOKIE, sessionToken, getSessionCookieOptions());
    response.cookies.set("londo_login_next", "", getCookieOptions(0));
    response.cookies.set(OAUTH_STATE_COOKIE, "", { ...getCookieOptions(0), maxAge: 0 });
    return response;
  } catch {
    return redirectToAuthError(request, "authentication_failed");
  }
}

export async function handleDiscordSignOutRequest(
  request: NextRequest,
): Promise<NextResponse> {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(sessionToken) },
    });
  }

  const response = NextResponse.redirect(new URL("/", getConfiguredAppOrigin(request)));
  response.cookies.set(SESSION_COOKIE, "", { ...getSessionCookieOptions(), maxAge: 0 });
  return response;
}
