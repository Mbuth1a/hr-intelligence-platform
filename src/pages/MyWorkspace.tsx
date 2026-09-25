import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, EVENT_TYPE_LABELS, formatDate, formatKES, formatTenure } from "@/lib/format";
import { BadgeCheck, CalendarDays, CalendarPlus, Loader2, LogIn, Send, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function monthsOfService(hireISO: string): number {
  const start = new Date(hireISO + "T00:00:00Z");
  const now = new Date();
  return Math.max(
    0,
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - start.getUTCMonth()),
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const statusTone: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  probation: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  on_leave: "bg-sky-500/15 text-sky-700 border-sky-500/25",
  offboarded: "bg-slate-500/12 text-slate-600 border-slate-400/30",
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/25",
  cancelled: "bg-slate-500/12 text-slate-600 border-slate-400/30",
};

function ToneBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`rounded-full border ${statusTone[status] ?? ""}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function MyWorkspace() {
  // Self-service queries (only valid when the login is linked to an employee)
  const status = useQuery(api.selfservice.myEmploymentStatus, {});
  const balances = useQuery(api.selfservice.myLeaveBalances, {});
  const myRequests = useQuery(api.selfservice.myLeaveRequests, {});

  // HR-side: approve/reject queue + linking tools
  const allRequests = useQuery(api.selfservice.allLeaveRequests, {});
  const employees = useQuery(api.employees.list, {});
  const decideLeave = useMutation(api.selfservice.decideLeave);
  const applyLeave = useMutation(api.selfservice.applyLeave);
  const cancelMyLeave = useMutation(api.selfservice.cancelMyLeave);
  const linkSelf = useMutation(api.selfservice.linkSelfToEmployee);
  const seedTypes = useMutation(api.selfservice.seedLeaveTypes);

  void seedTypes;

  const [applyOpen, setApplyOpen] = useState(false);
  const [typeCode, setTypeCode] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);

  // HR linking dialog
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkEmployeeId, setLinkEmployeeId] = useState("");
  const [linking, setLinking] = useState(false);

  const pending = useMemo(
    () => (allRequests ?? []).filter((r) => r.status === "pending"),
    [allRequests],
  );

  const isLinked = status !== null && status !== undefined;

  const handleApply = async () => {
    if (!typeCode) {
      toast.error("Choose a leave type.");
      return;
    }
    setApplying(true);
    try {
      await applyLeave({ leaveTypeCode: typeCode, startDate: from, endDate: to, reason });
      toast.success("Leave request submitted for HR approval.");
      setApplyOpen(false);
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply.");
    } finally {
      setApplying(false);
    }
  };

  const handleLink = async () => {
    if (!linkEmployeeId) {
      toast.error("Choose your employee record.");
      return;
    }
    setLinking(true);
    try {
      await linkSelf({ employeeId: linkEmployeeId as never });
      toast.success("Account linked — self-service unlocked.");
      setLinkOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link.");
    } finally {
      setLinking(false);
    }
  };

  if (status === undefined || balances === undefined || myRequests === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  // Not linked → show guidance (HR team accounts typically aren't employees)
  if (status === null) {
    return (
      <AppShell>
        <Card className="mx-auto mt-10 max-w-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LogIn className="size-6" />
            </div>
            <CardTitle>Self-service not linked</CardTitle>
            <CardDescription>
              This account isn&apos;t linked to an employee record yet. HR can link
              your login to your employee record to unlock leave applications and
              your employment status view.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {employees !== undefined && (
              <Button className="rounded-xl" onClick={() => setLinkOpen(true)}>
                <UserRound className="size-4" />
                Link this account to my employee record
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Tip: sign in with <strong>Continue as Guest</strong> (no email code
              needed), then pick your name — e.g. <em>Faith Njeri</em> — to link and
              unlock leave + employment status.
            </p>
          </CardContent>
        </Card>
        <LinkDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          employees={employees ?? []}
          employeeId={linkEmployeeId}
          setEmployeeId={setLinkEmployeeId}
          saving={linking}
          onSave={handleLink}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Employee self-service</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {status.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {status.employeeNumber} · {status.jobTitle}
            <ToneBadge status={status.status} />
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => setApplyOpen(true)} disabled={status.status === "offboarded"}>
          <CalendarPlus className="size-4" />
          Apply for leave
        </Button>
      </div>

      {/* Employment status */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-4 text-primary" />
              Employment status
            </CardTitle>
            <CardDescription>Live from your employee master record</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ["Department", status.department],
                ["Employment type", EMPLOYMENT_TYPE_LABELS[status.employmentType] ?? status.employmentType],
                ["Status", EMPLOYEE_STATUS_LABELS[status.status] ?? status.status],
                ["Hired", formatDate(status.hireDate)],
                ["Tenure", formatTenure(monthsOfService(status.hireDate))],
                ["Monthly gross", formatKES(status.monthlyGrossSalary)],
                ["Reports to", status.managerName ?? "—"],
                ["Location", status.location ?? "—"],
                ["Sign-in email", status.linkedEmail],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {status.recentEvents.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Recent changes
                </p>
                <div className="space-y-1.5">
                  {status.recentEvents.map((ev: Doc<"employeeEvents">) => (
                    <div key={ev._id} className="glass-subtle flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs">
                      <span className="font-medium">{EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}</span>
                      <span className="truncate text-muted-foreground">{ev.detail}</span>
                      <span className="shrink-0 text-muted-foreground">{formatDate(ev.effectiveDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave balances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leave balances {new Date().getUTCFullYear()}</CardTitle>
            <CardDescription>Entitlement + carry-forward − days taken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.map((b) => (
              <div key={b._id} className="glass-subtle rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{b.typeName}</p>
                  <span className="text-lg font-bold tabular-nums text-primary">
                    {b.available}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[oklch(0.48_0.09_230)] to-[oklch(0.62_0.09_195)]"
                    style={{
                      width: `${
                        b.entitled + b.carriedForward > 0
                          ? Math.min(100, Math.max(2, (b.available / (b.entitled + b.carriedForward)) * 100))
                          : 2
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {b.entitled} entitled · {b.carriedForward} carried · {b.daysTaken} taken
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* My leave requests */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">My leave requests</CardTitle>
          <CardDescription>
            {status.leave.pending} pending · {status.leave.approvedUpcoming} upcoming approved
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {myRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          ) : (
            myRequests.map((r) => (
              <div key={r._id} className="glass-subtle flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
                <CalendarDays className="size-4 text-primary" />
                <span className="text-sm font-semibold">{r.leaveTypeCode}</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)} · {r.days} working day{r.days === 1 ? "" : "s"}
                </span>
                <ToneBadge status={r.status} />
                {r.decisionNote && (
                  <span className="text-xs text-muted-foreground">“{r.decisionNote}”</span>
                )}
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 rounded-lg text-xs"
                    onClick={async () => {
                      try {
                        await cancelMyLeave({ requestId: r._id });
                        toast.success("Request cancelled.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed.");
                      }
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* HR approval queue */}
      {allRequests !== undefined && allRequests.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">HR — leave approvals</CardTitle>
            <CardDescription>Decisions update balances automatically and notify the employee.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests. 🎉</p>
            ) : (
              pending.map((r) => (
                <div key={r._id} className="glass-subtle flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {r.employeeName} <span className="text-xs font-normal text-muted-foreground">{r.employeeNumber}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.leaveTypeCode} · {formatDate(r.startDate)} → {formatDate(r.endDate)} · {r.days} day{r.days === 1 ? "" : "s"}
                      {r.reason ? ` · “${r.reason}”` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={async () => {
                      try {
                        await decideLeave({ requestId: r._id, decision: "approved" });
                        toast.success("Leave approved — balance updated.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed.");
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-rose-300 text-rose-600"
                    onClick={async () => {
                      try {
                        await decideLeave({ requestId: r._id, decision: "rejected", note: "Not approved this period" });
                        toast.success("Leave rejected.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed.");
                      }
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* HR linking tools */}
      {employees !== undefined && (
        <div className="mt-6 flex items-center justify-between rounded-2xl glass-subtle px-4 py-3">
          <p className="text-xs text-muted-foreground">
            HR tooling — link a login to an employee record to enable self-service.
          </p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setLinkOpen(true)}>
            <UserRound className="size-3.5" />
            Link account
          </Button>
        </div>
      )}

      {/* Apply dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="glass-strong sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for leave</DialogTitle>
            <DialogDescription>
              Working days are counted (weekends excluded). Balance is validated before submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select value={typeCode} onValueChange={setTypeCode}>
                <SelectTrigger className="glass-subtle w-full">
                  <SelectValue placeholder="Choose type…" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((b) => (
                    <SelectItem key={b.leaveTypeCode} value={b.leaveTypeCode}>
                      {b.typeName} · {b.available} day{b.available === 1 ? "" : "s"} available
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} min={todayISO()} onChange={(e) => setFrom(e.target.value)} className="glass-subtle" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="glass-subtle" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="glass-subtle" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="glass-subtle" onClick={() => setApplyOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HR link dialog */}
      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        employees={employees ?? []}
        employeeId={linkEmployeeId}
        setEmployeeId={setLinkEmployeeId}
        saving={linking}
        onSave={handleLink}
      />
    </AppShell>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  employees,
  employeeId,
  setEmployeeId,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employees: Doc<"employees">[];
  employeeId: string;
  setEmployeeId: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link this account</DialogTitle>
          <DialogDescription>
            Pick your employee record to unlock leave applications and your
            employment status view. One account links to one employee
            (Person ≠ User Account).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Employee record</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="glass-subtle w-full">
              <SelectValue placeholder="Choose employee…" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.firstName} {e.lastName} · {e.employeeNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" className="glass-subtle" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || !employeeId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Link account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

