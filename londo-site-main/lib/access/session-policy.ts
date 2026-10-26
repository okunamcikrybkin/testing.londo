import {resolveFamqFamilies} from "./famq";
import type { UserRole } from "@/lib/permissions/rbac";
import { emptyScopes, type Scopes } from "./policy";
export function sessionStaffState(session: {
  staffPinVerifiedAt: Date | null; staffPinCredentialVersion: number | null;
  user: { accessSnapshot?: {roleIds?:unknown} | null; role: UserRole; staffAccessGrants: ({ role: UserRole } & Scopes)[]; staffAccessCredential: { pinSetAt: Date | null; credentialVersion: number } | null };
}, fullAccess: boolean) {
  const famqFamilies=resolveFamqFamilies(session.user.accessSnapshot?.roleIds);
  const grant = session.user.staffAccessGrants[0];
  const credential = session.user.staffAccessCredential;
  const approvedRole = grant?.role ?? "USER";
  const pinConfigured = Boolean(credential?.pinSetAt);
  const pinVerified = fullAccess || Boolean(grant && credential?.pinSetAt && session.staffPinVerifiedAt && session.staffPinCredentialVersion === credential.credentialVersion);
  return { famqFamilies, baseFamilyAccess: {MEMPHIS: famqFamilies.includes("MEMPHIS") ? "FAMQ" as const : "USER" as const, PHOENIX: famqFamilies.includes("PHOENIX") ? "FAMQ" as const : "USER" as const}, approvedRole, pinConfigured, pinVerified, pinRequired: !fullAccess && approvedRole !== "USER" && !pinVerified,
    role: fullAccess ? session.user.role : pinVerified ? approvedRole : "USER" as UserRole,
    familyAccess: pinVerified && grant ? { MEMPHIS: grant.memphisRole, PHOENIX: grant.phoenixRole } : { MEMPHIS: emptyScopes.memphisRole, PHOENIX: emptyScopes.phoenixRole } };
}
