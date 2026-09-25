import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthsOfService(hireDateISO: string, endISO?: string): number {
  const start = new Date(hireDateISO + "T00:00:00Z");
  const end = new Date((endISO ?? todayISO()) + "T00:00:00Z");
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/**
 * Builds the analytics context handed to the AI copilot.
 * This is the "analytics / semantic layer" from the spec: the LLM only ever
 * sees this validated JSON, never the production tables directly.
 */
export const copilotContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const employees = await ctx.db.query("employees").collect();
    const departments = await ctx.db.query("departments").collect();
    const events = await ctx.db.query("employeeEvents").collect();

    const deptById = new Map(departments.map((d) => [d._id, d]));
    const empById = new Map(employees.map((e) => [e._id, e]));

    const current = employees.filter((e) => e.status !== "offboarded");
    const monthlyCost = current.reduce((s, e) => s + e.monthlyGrossSalary, 0);

    const departmentsCtx = departments.map((d) => {
      const staff = current.filter((e) => e.departmentId === d._id);
      const cost = staff.reduce((s, e) => s + e.monthlyGrossSalary, 0);
      return {
        name: d.name,
        code: d.code,
        headcount: staff.length,
        monthlyCostKES: cost,
        avgSalaryKES: staff.length ? Math.round(cost / staff.length) : 0,
        monthlyBudgetKES: d.monthlyBudget ?? null,
        budgetUtilisation:
          d.monthlyBudget && d.monthlyBudget > 0
            ? Math.round((cost / d.monthlyBudget) * 100)
            : null,
      };
    });

    const employeesCtx = employees.map((e) => {
      const dept = deptById.get(e.departmentId);
      const deptStaff = current.filter((x) => x.departmentId === e.departmentId);
      const deptAvg = deptStaff.length
        ? deptStaff.reduce((s, x) => s + x.monthlyGrossSalary, 0) / deptStaff.length
        : e.monthlyGrossSalary;
      return {
        name: `${e.firstName} ${e.lastName}`,
        number: e.employeeNumber,
        department: dept?.name ?? "—",
        jobTitle: e.jobTitle,
        employmentType: e.employmentType,
        status: e.status,
        hireDate: e.hireDate,
        exitDate: e.exitDate ?? null,
        tenureMonths: monthsOfService(e.hireDate, e.exitDate),
        monthlySalaryKES: e.monthlyGrossSalary,
        salaryVsDeptAvgPct: Math.round(
          ((e.monthlyGrossSalary - deptAvg) / deptAvg) * 100,
        ),
      };
    });

    // Consequential events from the last 12 months, most recent first
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const recentEvents = events
      .filter((ev) => ev.effectiveDate >= cutoffISO)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
      .map((ev: Doc<"employeeEvents">) => ({
        employee: empById.get(ev.employeeId)
          ? `${empById.get(ev.employeeId)!.firstName} ${empById.get(ev.employeeId)!.lastName}`
          : "Unknown",
        type: ev.eventType,
        effectiveDate: ev.effectiveDate,
        detail: ev.detail,
        oldValue: ev.oldValue ?? null,
        newValue: ev.newValue ?? null,
        recordedBy: ev.actorName ?? null,
      }));

    // Payroll history (spec §50): actual processed periods
    const periods = await ctx.db.query("payrollPeriods").collect();
    const slips = await ctx.db.query("payslips").collect();
    const payrollHistory = periods
      .sort((a, b) => a.periodLabel.localeCompare(b.periodLabel))
      .map((p) => {
        const ps = slips.filter((s) => s.periodId === p._id);
        const t = (f: (s: (typeof slips)[number]) => number) =>
          Math.round(ps.reduce((s, x) => s + f(x), 0));
        return {
          period: p.periodLabel,
          status: p.status,
          employeesPaid: ps.length,
          grossKES: t((s) => s.grossPay),
          netKES: t((s) => s.netPay),
          payeKES: t((s) => s.paye),
          nssfKES: t((s) => s.nssf),
          shifKES: t((s) => s.shif),
          ahlKES: t((s) => s.ahl),
          employerCostKES: t((s) => s.employerCost),
        };
      });

    return {
      asOfDate: todayISO(),
      currency: "KES",
      totals: {
        headcount: current.length,
        monthlyGrossPayrollKES: monthlyCost,
        avgSalaryKES: current.length
          ? Math.round(monthlyCost / current.length)
          : 0,
        offboardedTotal: employees.length - current.length,
        recentHires90d: current.filter((e) => {
          const c = new Date();
          c.setUTCDate(c.getUTCDate() - 90);
          return e.hireDate >= c.toISOString().slice(0, 10);
        }).length,
      },
      statusMix: {
        active: current.filter((e) => e.status === "active").length,
        probation: current.filter((e) => e.status === "probation").length,
        onLeave: current.filter((e) => e.status === "on_leave").length,
      },
      contractMix: {
        permanent: current.filter((e) => e.employmentType === "permanent").length,
        fixedTerm: current.filter((e) => e.employmentType === "fixed-term").length,
        internship: current.filter((e) => e.employmentType === "internship").length,
        contract: current.filter((e) => e.employmentType === "contract").length,
      },
      departments: departmentsCtx,
      employees: employeesCtx,
      recentEvents,
      payrollHistory,
    };
  },
});
