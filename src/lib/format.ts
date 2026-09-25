/** KES currency and date formatting helpers (Kenya primary market). */

export function formatKES(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (Math.abs(amount) >= 1_000_000)
      return `KES ${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
    if (Math.abs(amount) >= 1_000)
      return `KES ${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 0)}K`;
    return `KES ${amount.toFixed(0)}`;
  }
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  if (rest === 0) return `${years} yr${years > 1 ? "s" : ""}`;
  return `${years} yr${years > 1 ? "s" : ""} ${rest} mo`;
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "Permanent",
  "fixed-term": "Fixed-term",
  internship: "Internship",
  contract: "Contract",
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  on_leave: "On leave",
  offboarded: "Offboarded",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  hired: "Hired",
  salary_changed: "Salary changed",
  promoted: "Promoted",
  transferred: "Transferred",
  manager_changed: "Manager changed",
  status_changed: "Status changed",
  employee_updated: "Record updated",
  offboarded: "Offboarded",
};
