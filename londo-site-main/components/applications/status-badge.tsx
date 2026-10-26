import type { ApplicationStatus } from "@prisma/client";

const tones: Record<ApplicationStatus, "success" | "warning" | "danger" | undefined> = {
  ACCEPTED: "success",
  CALL: "warning",
  NEW: "warning",
  REJECTED: "danger",
};

const labels: Record<ApplicationStatus, string> = {
  ACCEPTED: "Принята",
  CALL: "На обзвоне",
  NEW: "Новая",
  REJECTED: "Отклонена",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className="londo-ui-badge" data-tone={tones[status]}>
      {labels[status]}
    </span>
  );
}
