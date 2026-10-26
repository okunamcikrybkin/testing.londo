import { sessionStaffState } from "@/lib/access/session-policy";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isStaffPage, safeStaffNext } from "@/lib/access/policy";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/auth/discord";
import { prisma } from "@/lib/db/prisma";
import { safeBirthdayReturnPath } from "@/lib/profile/birthday";
import {
  getEffectiveAccess,
  type EffectiveAccess,
  type UserRole,
  type UserStatus,
} from "@/lib/permissions/rbac";

export type SessionUser = {
  id: string;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  famqFamilies?: ("MEMPHIS" | "PHOENIX")[];
  baseFamilyAccess?: {MEMPHIS:"USER"|"FAMQ";PHOENIX:"USER"|"FAMQ"};
  familyAccess?: { MEMPHIS: UserRole; PHOENIX: UserRole };
  accessObservedAt?: Date | null;
  approvedRole?: UserRole;
  pinConfigured?: boolean;
  pinVerified?: boolean;
  pinRequired?: boolean;
  role: UserRole;
  effectiveAccess: EffectiveAccess;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
};

/** Reads the opaque httpOnly session cookie and validates it against PostgreSQL. */
export async function getCurrentUser(options: { allowIncompleteBirthday?: boolean } = {}): Promise<SessionUser | null> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(sessionToken) },
    include: { user: { include: { accessSnapshot: true, staffAccessGrants: { where: { revokedAt: null } }, staffAccessCredential: { select: { pinSetAt: true, credentialVersion: true } } } } },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
    return null;
  }

  const staff = sessionStaffState(session, getEffectiveAccess(session.user) === "FULL_ACCESS");
  const path = (await headers()).get("x-londo-current-path") ?? "";
  const pathname = path.split(/[?#]/, 1)[0];
  if (!options.allowIncompleteBirthday && (session.user.birthdayMonth === null || session.user.birthdayDay === null || session.user.birthdayYear === null) && pathname !== "/profile/birthday" && !pathname.startsWith("/api/")) {
    redirect(`/profile/birthday?next=${encodeURIComponent(safeBirthdayReturnPath(pathname))}`);
  }
  if (staff.pinRequired && isStaffPage(path)) redirect(`/access/pin/${staff.pinConfigured ? "verify" : "setup"}?next=${encodeURIComponent(safeStaffNext(path))}`);
  const role = staff.role;
  const discordId = session.user.discordId;

  return {
    ...staff,
    accessObservedAt: session.user.accessSnapshot?.observedAt ?? null,
    avatarUrl: session.user.avatar,
    createdAt: session.user.createdAt,
    discordId,
    displayName: session.user.displayName,
    id: session.user.id,
    lastLoginAt: session.user.lastLoginAt,
    birthdayMonth: session.user.birthdayMonth,
    birthdayDay: session.user.birthdayDay,
    birthdayYear: session.user.birthdayYear,
    effectiveAccess: getEffectiveAccess({ discordId, role, famqFamilies:staff.famqFamilies }),
    role,
    status: session.user.status,
    username: session.user.username,
  };
}
