import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatKES } from "@/lib/format";
import { AlertTriangle, Ban, CalendarRange, CheckCircle2, FileSpreadsheet, Loader2, Lock, Play, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const statusTone: Record<string, string> = {
  OPEN: "bg-sky-500/15 text-sky-700 border-sky-500/25",
  CALCULATED: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  UNDER_REVIEW: "bg-violet-500/15 text-violet-700 border-violet-500/25",
  APPROVED: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  LOCKED: "bg-slate-500/15 text-slate-600 border-slate-400/30",
};

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`rounded-full border ${statusTone[status] ?? ""}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const periods = useQuery(api.payroll.periods, {});
  const rules = useQuery(api.payroll.currentRules, {});

  const [selectedId, setSelectedId] = useState<Id<"payrollPeriods"> | null>(null);
  const selected = useMemo(
    () => periods?.find((p) => p._id === (selectedId ?? periods[0]?._id)),
    [periods, selectedId],
  );
  const payslips = useQuery(
    api.payroll.periodPayslips,
    selected ? { periodId: selected._id } : "skip",
  );
  const journal = useQuery(
    api.payroll.journal,
    selected ? { periodId: selected._id } : "skip",
  );

  const runPeriod = useMutation(api.payroll.runPeriod);
  const approvePeriod = useMutation(api.payroll.approvePeriod);
  const lockPeriod = useMutation(api.payroll.lockPeriod);

  const [runOpen, setRunOpen] = useState(false);
  const [runLabel, setRunLabel] = useState(ym(new Date()));
  const [running, setRunning] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);

  const actor = user?.name || user?.email || "HR team";

  const doRun = async () => {
    if (!/^\d{4}-\d{2}$/.test(runLabel)) {
      toast.error("Period must look like 2026-08.");
      return;
    }
    setRunning(true);
    try {
      const res = await runPeriod({ periodLabel: runLabel, actorName: actor });
      toast.success(
        `Payroll calculated: ${res.report.successful}/${res.report.processed} OK, ${res.report.warnings} warning(s), ${res.report.blockingErrors} blocking error(s).`,
      );
      setRunOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run payroll.");
    } finally {
      setRunning(false);
    }
  };

  const doApprove = async () => {
    if (!selected) return;
    try {
      await approvePeriod({ periodId: selected._id, actorName: actor });
      toast.success(`Payroll for ${selected.periodLabel} approved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve.");
    }
  };

  const doLock = async () => {
    if (!selected) return;
    try {
      await lockPeriod({ periodId: selected._id, actorName: actor });
      toast.success(`Payroll for ${selected.periodLabel} locked. Results are now immutable.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to lock.");
    }
  };

  if (periods === undefined || rules === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const report = selected?.validationReport;
  const canApprove = selected?.status === "CALCULATED" || selected?.status === "UNDER_REVIEW";
  const canLock = selected?.status === "APPROVED";

  return (
    <AppShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Compensate · Pay</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Engine runs on versioned KE statutory rules v{rules.version} (effective {rules.effectiveFrom}).
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => setRunOpen(true)}>
          <Play className="size-4" />
          Run payroll
        </Button>
      </div>

      {/* Period selector */}
      <div className="mt-6 flex flex-wrap gap-2">
        {periods.length === 0 && (
          <p className="text-sm text-muted-foreground">No payroll periods yet — run your first one.</p>
        )}
        {periods.map((p) => (
          <button
            key={p._id}
            onClick={() => setSelectedId(p._id)}
            className={`glass-subtle rounded-2xl px-4 py-3 text-left transition hover:bg-white/70 ${
              (selected?._id ?? periods[0]?._id) === p._id ? "ring-2 ring-primary/60" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarRange className="size-4 text-primary" />
              <span className="font-semibold">{p.periodLabel}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.totals
                ? `${formatKES(p.totals.net, { compact: true })} net`
                : p.validationReport
                  ? `${p.validationReport.processed} employees`
                  : "—"}
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Summary + validation */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">Period summary — {selected.periodLabel}</CardTitle>
                  <CardDescription>
                    Pay date {selected.payDate} · statutory rules v{selected.ruleVersion}
                  </CardDescription>
                </div>
                <StatusBadge status={selected.status} />
              </CardHeader>
              <CardContent>
                {payslips === undefined ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : payslips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payslips for this period.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Gross", value: payslips.reduce((s, x) => s + x.grossPay, 0) },
                      { label: "PAYE", value: payslips.reduce((s, x) => s + x.paye, 0) },
                      { label: "Deductions", value: payslips.reduce((s, x) => s + x.totalDeductions, 0) },
                      { label: "Net pay", value: payslips.reduce((s, x) => s + x.netPay, 0) },
                    ].map((k) => (
                      <div key={k.label} className="glass-subtle rounded-2xl p-3.5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{k.label}</p>
                        <p className="mt-1 text-lg font-bold tabular-nums">{formatKES(k.value, { compact: true })}</p>
                      </div>
                    ))}
                  </div>
                )}

                {report && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <span className="font-semibold">Validation report</span>
                      {report.blockingErrors > 0 ? (
                        <Badge className="rounded-full bg-destructive/12 text-destructive">
                          <AlertTriangle className="size-3" />
                          {report.blockingErrors} blocking
                        </Badge>
                      ) : (
                        <Badge className="rounded-full bg-emerald-500/12 text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          clean
                        </Badge>
                      )}
                      {report.warnings > 0 && (
                        <Badge variant="outline" className="rounded-full bg-white/60">
                          {report.warnings} warning{report.warnings === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Employees processed: {report.processed} · Successful: {report.successful} ·
                      Warnings: {report.warnings} · Blocking errors: {report.blockingErrors}
                    </p>
                    {report.messages.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {report.messages.slice(0, 6).map((m, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                            {m}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="glass-subtle rounded-xl"
                    onClick={doApprove}
                    disabled={!canApprove}
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                  <Button className="rounded-xl" onClick={doLock} disabled={!canLock}>
                    <Lock className="size-4" />
                    Lock period
                  </Button>
                  <Button variant="outline" className="glass-subtle rounded-xl" onClick={() => setJournalOpen(true)}>
                    <FileSpreadsheet className="size-4" />
                    Accounting journal
                  </Button>
                  {selected.status === "CALCULATED" && (
                    <span className="ml-auto self-center text-xs text-muted-foreground">
                      Approval is blocked while blocking errors exist (BR-001)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow</CardTitle>
                <CardDescription>Calculation → review → approval → lock</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {[
                  { s: "CALCULATED", ok: true, label: "Engine ran, payslips drafted" },
                  { s: "APPROVED", ok: selected.status === "APPROVED" || selected.status === "LOCKED", label: selected.approvedBy ? `Approved by ${selected.approvedBy}` : "Awaiting approval" },
                  { s: "LOCKED", ok: selected.status === "LOCKED", label: selected.lockedBy ? `Locked by ${selected.lockedBy}` : "Immutable after lock" },
                ].map((step) => (
                  <div key={step.s} className="flex items-center gap-2.5">
                    {step.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Ban className="size-4 text-muted-foreground/50" />
                    )}
                    <span className={step.ok ? "font-medium" : "text-muted-foreground"}>{step.label}</span>
                  </div>
                ))}
                {selected.status === "LOCKED" && (
                  <p className="mt-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700">
                    This period is locked. Corrections require a new adjustment run — history is preserved (BR-002).
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payslips table */}
          <Card className="mt-4 overflow-hidden py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Employee</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">PAYE</TableHead>
                    <TableHead className="text-right">NSSF</TableHead>
                    <TableHead className="text-right">SHIF</TableHead>
                    <TableHead className="text-right">AHL</TableHead>
                    <TableHead className="pr-5 text-right">Net pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payslips ?? []).map((s) => (
                    <TableRow key={s._id} className="cursor-pointer" onClick={() => setPayslipOpen(s._id)}>
                      <TableCell className="pl-5">
                        <p className="font-medium">{s.employeeNumber}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.reference}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKES(s.grossPay)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKES(s.paye)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKES(s.nssf)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKES(s.shif)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKES(s.ahl)}</TableCell>
                      <TableCell className="pr-5 text-right font-semibold tabular-nums">{formatKES(s.netPay)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* Run dialog */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="glass-strong sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run payroll</DialogTitle>
            <DialogDescription>
              Calculates all non-offboarded employees using versioned statutory rules, then produces a validation report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="period">Period (YYYY-MM)</Label>
            <Input id="period" value={runLabel} onChange={(e) => setRunLabel(e.target.value)} placeholder="2026-09" className="glass-subtle" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="glass-subtle" onClick={() => setRunOpen(false)} disabled={running}>
              Cancel
            </Button>
            <Button onClick={doRun} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Calculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip detail */}
      <Dialog open={payslipOpen !== null} onOpenChange={(o) => !o && setPayslipOpen(null)}>
        <DialogContent className="glass-strong sm:max-w-lg">
          {(() => {
            const slip = payslips?.find((s) => s._id === payslipOpen);
            if (!slip) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Payslip {slip.reference}</DialogTitle>
                  <DialogDescription>Period {slip.periodLabel} · unique reference, traceable inputs</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {slip.lines.map((l) => (
                    <div key={l.code} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">{l.label}</p>
                        <p className="text-[11px] text-muted-foreground">source: {l.source}</p>
                      </div>
                      <span className={`tabular-nums font-semibold ${l.amount < 0 ? "text-destructive" : ""}`}>
                        {l.amount < 0 ? "−" : ""}{formatKES(Math.abs(l.amount))}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-white/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Net pay</span>
                      <span className="flex items-center gap-1.5 text-lg font-bold text-primary">
                        <Wallet className="size-4" />
                        {formatKES(slip.netPay)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Taxable pay {formatKES(slip.taxablePay)} · employer cost {formatKES(slip.employerCost)}
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Journal dialog */}
      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="glass-strong sm:max-w-xl">
          {journal && (
            <>
              <DialogHeader>
                <DialogTitle>Accounting journal — {journal.journalRef}</DialogTitle>
                <DialogDescription>
                  Generated from payroll run {journal.period} · rules v{journal.ruleVersion} ·{" "}
                  {journal.balanced ? "balanced ✓" : "unbalanced ⚠"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Account</span>
                  <span className="text-right">DR</span>
                  <span className="text-right">CR</span>
                </div>
                {journal.lines.map((l) => (
                  <div key={l.account} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-lg px-1 py-1 text-sm odd:bg-white/40">
                    <span>{l.account}</span>
                    <span className="text-right tabular-nums">{l.dr ? formatKES(l.dr) : "—"}</span>
                    <span className="text-right tabular-nums">{l.cr ? formatKES(l.cr) : "—"}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-white/60 pt-2 font-bold">
                  <span>Totals</span>
                  <span className="text-right tabular-nums">{formatKES(journal.dr)}</span>
                  <span className="text-right tabular-nums">{formatKES(journal.cr)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
