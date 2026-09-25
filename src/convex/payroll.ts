import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import {
  KENYA_STATUTORY_RULES_V1,
  calcEmployeePayroll,
  type StatutoryRulePackage,
} from "../lib/payroll-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireUser(ctx: unknown) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

function monthEndISO(label: string): string {
  const [y, m] = label.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function payslipRef(periodLabel: string, employeeNumber: string): string {
  return `PS-${periodLabel}-${employeeNumber}`;
}

function journalRefFor(periodLabel: string, id: string): string {
  return `JV-${periodLabel}-${id.slice(-6).toUpperCase()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sum(nums: number[]): number {
  return round2(nums.reduce((a, b) => a + b, 0));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Latest statutory rule package in force (BR-007). */
export const currentRules = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const doc = await ctx.db
      .query("statutoryRules")
      .withIndex("by_version", (q) => q.eq("version", 1))
      .first();
    if (doc) return JSON.parse(doc.packageJson) as StatutoryRulePackage;
    return KENYA_STATUTORY_RULES_V1;
  },
});

/** All payroll periods, newest first. */
export const periods = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("payrollPeriods").collect();
    return rows.sort((a, b) => b.periodLabel.localeCompare(a.periodLabel));
  },
});

/** Payslips of one period. */
export const periodPayslips = query({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", args.periodId))
      .collect();
    return slips.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
  },
});

/** Payslip history for one employee. */
export const employeePayslips = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    return slips.sort((a, b) => b.periodLabel.localeCompare(a.periodLabel));
  },
});

/**
 * Accounting journal for a period (spec §47, BR-009).
 * Derived deterministically from payslips; every line references the run.
 */
export const journal = query({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) return null;
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", args.periodId))
      .collect();

    const gross = sum(slips.map((s) => s.grossPay));
    const nssfEe = sum(slips.map((s) => s.nssf));
    const shifEe = sum(slips.map((s) => s.shif));
    const ahl = sum(slips.map((s) => s.ahl));
    const paye = sum(slips.map((s) => s.paye));
    const net = sum(slips.map((s) => s.netPay));
    const nssfEr = nssfEe; // employer matches employee NSSF
    const shifEr = shifEe; // employer matches employee SHIF

    const lines = [
      { account: "7100 · Salary Expense", dr: gross, cr: 0 },
      { account: "7150 · Employer NSSF", dr: nssfEr, cr: 0 },
      { account: "7160 · Employer SHIF", dr: shifEr, cr: 0 },
      { account: "7170 · Employer AHL", dr: ahl, cr: 0 },
      { account: "2210 · Salary Payable", dr: 0, cr: net },
      { account: "2220 · PAYE Payable", dr: 0, cr: paye },
      { account: "2230 · NSSF Payable", dr: 0, cr: nssfEe + nssfEr },
      { account: "2240 · SHIF Payable", dr: 0, cr: shifEe + shifEr },
      { account: "2250 · AHL Payable", dr: 0, cr: ahl * 2 },
    ];

    const dr = round2(lines.reduce((s, l) => s + l.dr, 0));
    const cr = round2(lines.reduce((s, l) => s + l.cr, 0));

    return {
      period: period.periodLabel,
      journalRef: period.journalRef ?? journalRefFor(period.periodLabel, period._id),
      ruleVersion: period.ruleVersion,
      lines,
      totals: { gross, nssfEe, shifEe, ahl, paye, net, nssfEr, shifEr },
      dr,
      cr,
      balanced: Math.abs(dr - cr) < 0.01,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Run payroll for a period label like "2026-08" for all non-offboarded staff.
 * Produces payslips + a validation report (spec §42). Re-running an OPEN
 * period replaces its payslips; approved/locked periods are immutable (BR-002).
 */
export const runPeriod = mutation({
  args: {
    periodLabel: v.string(),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const label = args.periodLabel.trim();
    if (!/^\d{4}-\d{2}$/.test(label)) {
      throw new Error("Period must look like 2026-08.");
    }
    const startISO = `${label}-01`;
    const endISO = monthEndISO(label);

    const existing = await ctx.db
      .query("payrollPeriods")
      .withIndex("by_label", (q) => q.eq("periodLabel", label))
      .first();
    if (existing && existing.status !== "OPEN" && existing.status !== "CALCULATED") {
      throw new Error(
        `Period ${label} is ${existing.status}; approved/locked periods cannot be re-run (BR-002).`,
      );
    }

    // Statutory rules in force (BR-007): versioned + effective-dated
    let rules: StatutoryRulePackage = KENYA_STATUTORY_RULES_V1;
    const ruleDoc = await ctx.db
      .query("statutoryRules")
      .withIndex("by_version", (q) => q.eq("version", KENYA_STATUTORY_RULES_V1.version))
      .first();
    if (ruleDoc) rules = JSON.parse(ruleDoc.packageJson);

    const employees = await ctx.db.query("employees").collect();
    const departments = await ctx.db.query("departments").collect();
    const deptNames = new Map(departments.map((d) => [d._id, d.name]));

    const staff = employees.filter((e) => e.status !== "offboarded");
    if (staff.length === 0) throw new Error("No active employees to pay.");

    // Validation phase (spec §42)
    const blockingErrors: string[] = [];
    const warnings: string[] = [];
    const calcs = [];

    for (const e of staff) {
      const calc = calcEmployeePayroll(
        {
          _id: e._id,
          employeeNumber: e.employeeNumber,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          employmentType: e.employmentType,
          status: e.status,
          monthlyGrossSalary: e.monthlyGrossSalary,
          departmentName: deptNames.get(e.departmentId) ?? "—",
        },
        rules,
      );
      calcs.push(calc);
      if (calc.netPay < 0) blockingErrors.push(`${calc.name}: negative net pay`);
      if (!e.email.includes("@")) {
        blockingErrors.push(`${calc.name}: invalid email on record`);
      }
      for (const w of calc.warnings) warnings.push(`${calc.name}: ${w}`);
    }

    const report = {
      processed: calcs.length,
      successful: calcs.length - blockingErrors.length,
      warnings: warnings.length,
      blockingErrors: blockingErrors.length,
      messages: [...warnings.slice(0, 8), ...blockingErrors.slice(0, 8)],
    };

    // Persist period (CALCULATED even with errors — approval is blocked instead)
    let periodId: import("./_generated/dataModel").Id<"payrollPeriods">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        startDate: startISO,
        endDate: endISO,
        payDate: endISO,
        status: "CALCULATED",
        ruleVersion: rules.version,
        validationReport: report,
        approvedBy: undefined,
        approvedAt: undefined,
      });
      periodId = existing._id;
    } else {
      periodId = await ctx.db.insert("payrollPeriods", {
        periodLabel: label,
        startDate: startISO,
        endDate: endISO,
        payDate: endISO,
        frequency: "monthly" as const,
        status: "CALCULATED",
        ruleVersion: rules.version,
        validationReport: report,
      });
    }

    // Replace payslips for re-runs of unapproved periods
    const oldSlips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", periodId))
      .collect();
    for (const s of oldSlips) await ctx.db.delete(s._id);

    for (const c of calcs) {
      await ctx.db.insert("payslips", {
        periodId,
        periodLabel: label,
        employeeId: c.employeeId as never,
        employeeNumber: c.employeeNumber,
        reference: payslipRef(label, c.employeeNumber),
        grossPay: c.grossPay,
        taxablePay: c.taxablePay,
        paye: c.paye,
        nssf: c.nssfEmployee,
        shif: c.shif,
        ahl: c.ahl,
        totalDeductions: c.totalDeductions,
        netPay: c.netPay,
        employerCost: c.employerCost,
        lines: c.lines,
        warnings: c.warnings,
      });
    }

    // Store rollup totals for dashboards / copilot (traceable to this run)
    await ctx.db.patch(periodId, {
      totals: {
        employees: calcs.length,
        gross: sum(calcs.map((c) => c.grossPay)),
        net: sum(calcs.map((c) => c.netPay)),
        paye: sum(calcs.map((c) => c.paye)),
        nssf: sum(calcs.map((c) => c.nssfEmployee)),
        shif: sum(calcs.map((c) => c.shif)),
        ahl: sum(calcs.map((c) => c.ahl)),
        employerCost: sum(calcs.map((c) => c.employerCost)),
      },
    });

    return { periodId, report };
  },
});

/** Approve a calculated period. Blocked while blocking errors exist (BR-001). */
export const approvePeriod = mutation({
  args: { periodId: v.id("payrollPeriods"), actorName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error("Period not found.");

    if (period.status === "APPROVED" || period.status === "LOCKED") {
      throw new Error("Period already approved or locked.");
    }
    if (period.status !== "CALCULATED" && period.status !== "UNDER_REVIEW") {
      throw new Error(`Cannot approve a period in status ${period.status}.`);
    }
    const report = period.validationReport;
    if (report && report.blockingErrors > 0) {
      throw new Error(
        `Cannot approve: ${report.blockingErrors} blocking validation error(s) remain (BR-001). Fix and re-run the period.`,
      );
    }

    await ctx.db.patch(args.periodId, {
      status: "APPROVED",
      approvedBy: args.actorName ?? "HR team",
      approvedAt: Date.now(),
    });
    return args.periodId;
  },
});

/** Lock an approved period: results become immutable (BR-002), journal assigned. */
export const lockPeriod = mutation({
  args: { periodId: v.id("payrollPeriods"), actorName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error("Period not found.");
    if (period.status !== "APPROVED") {
      throw new Error("Only approved periods can be locked.");
    }
    await ctx.db.patch(period._id, {
      status: "LOCKED",
      lockedBy: args.actorName ?? "HR team",
      lockedAt: Date.now(),
      journalRef: journalRefFor(period.periodLabel, period._id),
    });
    return period._id;
  },
});
