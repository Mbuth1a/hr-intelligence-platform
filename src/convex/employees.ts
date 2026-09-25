import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Months of service as of today (whole months, min 0). */
function monthsOfService(hireDateISO: string, endISO?: string): number {
  const start = new Date(hireDateISO + "T00:00:00Z");
  const end = new Date((endISO ?? todayISO()) + "T00:00:00Z");
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/** A person counts toward headcount while not offboarded (active/probation/on_leave). */
function countsTowardHeadcount(e: Doc<"employees">): boolean {
  return e.status !== "offboarded";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List employees with optional filters. Search matches name, number, title, email. */
export const list = query({
  args: {
    status: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    let rows: Doc<"employees">[];
    if (args.status) {
      rows = await ctx.db
        .query("employees")
        .withIndex("by_status", (q) => q.eq("status", args.status as "active"))
        .collect();
    } else {
      rows = await ctx.db.query("employees").collect();
    }

    if (args.departmentId) {
      rows = rows.filter((r) => r.departmentId === args.departmentId);
    }
    if (args.search) {
      const s = args.search.trim().toLowerCase();
      rows = rows.filter((r) =>
        [
          r.firstName,
          r.lastName,
          r.employeeNumber,
          r.jobTitle,
          r.email,
        ]
          .join(" ")
          .toLowerCase()
          .includes(s),
      );
    }

    rows.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
    return rows;
  },
});

/** Single employee with its full event history (oldest first). */
export const get = query({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const employee = await ctx.db.get(args.id);
    if (!employee) return null;

    const events = await ctx.db
      .query("employeeEvents")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.id))
      .collect();
    events.sort((a, b) =>
      a.effectiveDate === b.effectiveDate
        ? a._creationTime - b._creationTime
        : a.effectiveDate.localeCompare(b.effectiveDate),
    );

    const department = await ctx.db.get(employee.departmentId);
    return { employee, department, events };
  },
});

/**
 * Employees-module dashboard aggregates: movement, tenure, contracts, anniversaries.
 */
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const all = await ctx.db.query("employees").collect();
    const current = all.filter(countsTowardHeadcount);

    // 12-month movement: hires and exits per month
    const months: { label: string; hires: number; exits: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const monthStart = `${label}-01`;
      const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
      months.push({
        label,
        hires: all.filter((e) => e.hireDate >= monthStart && e.hireDate <= monthEnd).length,
        exits: all.filter(
          (e) => e.exitDate && e.exitDate >= monthStart && e.exitDate <= monthEnd,
        ).length,
      });
    }

    // Tenure buckets (years)
    const tenureYears = (e: Doc<"employees">) =>
      monthsOfService(e.hireDate, e.exitDate) / 12;
    const tenureBuckets = {
      "0-1": current.filter((e) => tenureYears(e) < 1).length,
      "1-3": current.filter((e) => tenureYears(e) >= 1 && tenureYears(e) < 3).length,
      "3-5": current.filter((e) => tenureYears(e) >= 3 && tenureYears(e) < 5).length,
      "5+": current.filter((e) => tenureYears(e) >= 5).length,
    };

    // Salary stats (current staff)
    const salaries = current.map((e) => e.monthlyGrossSalary).sort((a, b) => a - b);
    const salaryStats = {
      min: salaries[0] ?? 0,
      max: salaries[salaries.length - 1] ?? 0,
      avg: salaries.length
        ? Math.round(salaries.reduce((s, x) => s + x, 0) / salaries.length)
        : 0,
      median: salaries.length
        ? salaries[Math.floor(salaries.length / 2)]
        : 0,
    };

    // Locations
    const locationsMap = new Map<string, number>();
    for (const e of current) {
      const key = e.location ?? "Unspecified";
      locationsMap.set(key, (locationsMap.get(key) ?? 0) + 1);
    }
    const byLocation = [...locationsMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Recent hires (last 90 days)
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const recentHires = current
      .filter((e) => e.hireDate >= cutoffISO)
      .sort((a, b) => b.hireDate.localeCompare(a.hireDate))
      .slice(0, 6)
      .map((e) => ({
        name: `${e.firstName} ${e.lastName}`,
        employeeNumber: e.employeeNumber,
        jobTitle: e.jobTitle,
        hireDate: e.hireDate,
        status: e.status,
      }));

    // Upcoming anniversaries (within 45 days)
    const dayMs = 24 * 60 * 60 * 1000;
    const today = new Date(todayISO() + "T00:00:00Z");
    const upcoming = all
      .filter((e) => e.status !== "offboarded")
      .map((e) => {
        const hire = new Date(e.hireDate + "T00:00:00Z");
        let anniv = new Date(
          Date.UTC(
            today.getUTCFullYear(),
            hire.getUTCMonth(),
            hire.getUTCDate(),
          ),
        );
        if (anniv.getTime() < today.getTime()) {
          anniv = new Date(
            Date.UTC(
              today.getUTCFullYear() + 1,
              hire.getUTCMonth(),
              hire.getUTCDate(),
            ),
          );
        }
        const daysAway = Math.round((anniv.getTime() - today.getTime()) / dayMs);
        const years = today.getUTCFullYear() - hire.getUTCFullYear();
        return {
          name: `${e.firstName} ${e.lastName}`,
          employeeNumber: e.employeeNumber,
          years,
          date: anniv.toISOString().slice(0, 10),
          daysAway,
        };
      })
      .filter((a) => a.daysAway <= 45)
      .sort((a, b) => a.daysAway - b.daysAway)
      .slice(0, 6);

    // Probation watch
    const probation = current
      .filter((e) => e.status === "probation")
      .map((e) => ({
        name: `${e.firstName} ${e.lastName}`,
        employeeNumber: e.employeeNumber,
        jobTitle: e.jobTitle,
        hireDate: e.hireDate,
        monthsIn: monthsOfService(e.hireDate),
      }))
      .sort((a, b) => b.monthsIn - a.monthsIn);

    return {
      headcount: current.length,
      offboardedCount: all.length - current.length,
      months,
      tenureBuckets,
      salaryStats,
      byLocation,
      recentHires,
      upcomingAnniversaries: upcoming,
      probation,
    };
  },
});

/**
 * Headcount & cost summary — the must-have main-screen metric.
 * headcount = employees not offboarded; monthly cost = sum of their gross salary.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const all = await ctx.db.query("employees").collect();
    const departments = await ctx.db.query("departments").collect();
    const deptById = new Map(departments.map((d) => [d._id, d]));

    const current = all.filter(countsTowardHeadcount);
    const offboarded = all.filter((e) => e.status === "offboarded");

    const monthlyCost = current.reduce((sum, e) => sum + e.monthlyGrossSalary, 0);
    const avgSalary = current.length ? monthlyCost / current.length : 0;

    // New hires in the last 90 days
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const recentHires = current.filter((e) => e.hireDate >= cutoffISO).length;

    // Average tenure in months across current staff
    const totalMonths = current.reduce(
      (sum, e) => sum + monthsOfService(e.hireDate),
      0,
    );
    const avgTenureMonths = current.length ? totalMonths / current.length : 0;

    // Per-department rollup
    const byDepartment = departments
      .map((d) => {
        const staff = current.filter((e) => e.departmentId === d._id);
        const cost = staff.reduce((s, e) => s + e.monthlyGrossSalary, 0);
        return {
          departmentId: d._id,
          name: d.name,
          code: d.code,
          headcount: staff.length,
          monthlyCost: cost,
          avgSalary: staff.length ? cost / staff.length : 0,
          budget: d.monthlyBudget ?? null,
        };
      })
      .sort((a, b) => b.monthlyCost - a.monthlyCost);

    const byStatus = {
      active: current.filter((e) => e.status === "active").length,
      probation: current.filter((e) => e.status === "probation").length,
      on_leave: current.filter((e) => e.status === "on_leave").length,
      offboarded: offboarded.length,
    };

    const byType = {
      permanent: current.filter((e) => e.employmentType === "permanent").length,
      "fixed-term": current.filter((e) => e.employmentType === "fixed-term").length,
      internship: current.filter((e) => e.employmentType === "internship").length,
      contract: current.filter((e) => e.employmentType === "contract").length,
    };

    // 6-month payroll cost history (from closed-off events? v1: salary events + hires)
    // Simple projection: current cost minus/plus known salary changes per month window.
    const months: { label: string; cost: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
      const label = d.toLocaleString("en-GB", { month: "short" });
      months.push({ label, cost: 0 });
    }
    // Reconstruct cost at end of each month from events + current salaries (best effort v1)
    for (const e of all) {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - i);
        const monthEnd = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        )
          .toISOString()
          .slice(0, 10);
        // employed at month end?
        if (e.hireDate <= monthEnd && (!e.exitDate || e.exitDate > monthEnd)) {
          months[5 - i].cost += e.monthlyGrossSalary; // v1 approximation
        }
      }
    }

    return {
      headcount: current.length,
      monthlyCost,
      avgSalary,
      avgTenureMonths,
      recentHires,
      offboardedCount: offboarded.length,
      byStatus,
      byType,
      byDepartment,
      months,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function nextEmployeeNumber(existing: Doc<"employees">[]): string {
  let max = 0;
  for (const e of existing) {
    const m = /^KIF-(\d+)$/.exec(e.employeeNumber);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `KIF-${String(max + 1).padStart(4, "0")}`;
}

export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    jobTitle: v.string(),
    departmentId: v.id("departments"),
    employmentType: v.string(),
    status: v.string(),
    hireDate: v.string(),
    monthlyGrossSalary: v.number(),
    managerName: v.optional(v.string()),
    location: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const existing = await ctx.db.query("employees").collect();
    if (existing.some((e) => e.email.toLowerCase() === args.email.toLowerCase())) {
      throw new Error("An employee with this email already exists.");
    }

    const employeeNumber = nextEmployeeNumber(existing);
    const employeeId = await ctx.db.insert("employees", {
      employeeNumber,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email: args.email.trim(),
      phone: args.phone?.trim() || undefined,
      jobTitle: args.jobTitle.trim(),
      departmentId: args.departmentId,
      employmentType: args.employmentType as "permanent",
      status: args.status as "active",
      hireDate: args.hireDate,
      monthlyGrossSalary: args.monthlyGrossSalary,
      managerName: args.managerName?.trim() || undefined,
      location: args.location?.trim() || undefined,
    });

    await ctx.db.insert("employeeEvents", {
      employeeId,
      eventType: "hired",
      effectiveDate: args.hireDate,
      detail: `Joined as ${args.jobTitle} (${args.employmentType})`,
      newValue: `KES ${args.monthlyGrossSalary.toLocaleString()} / month`,
      actorName: args.actorName,
    });

    return employeeId;
  },
});

export const update = mutation({
  args: {
    id: v.id("employees"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    jobTitle: v.string(),
    departmentId: v.id("departments"),
    employmentType: v.string(),
    status: v.string(),
    monthlyGrossSalary: v.number(),
    managerName: v.optional(v.string()),
    location: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Employee not found");

    const dup = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim()))
      .first();
    if (dup && dup._id !== args.id) {
      throw new Error("Another employee already uses this email.");
    }

    const next = {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email: args.email.trim(),
      phone: args.phone?.trim() || undefined,
      jobTitle: args.jobTitle.trim(),
      departmentId: args.departmentId,
      employmentType: args.employmentType as "permanent",
      status: args.status as "active",
      monthlyGrossSalary: args.monthlyGrossSalary,
      managerName: args.managerName?.trim() || undefined,
      location: args.location?.trim() || undefined,
    };

    await ctx.db.patch(args.id, next);

    // Record consequential events (P2 — never overwrite history)
    const today = todayISO();
    const actor = args.actorName;

    if (current.monthlyGrossSalary !== next.monthlyGrossSalary) {
      await ctx.db.insert("employeeEvents", {
        employeeId: args.id,
        eventType: "salary_changed",
        effectiveDate: today,
        detail: "Salary changed",
        oldValue: `KES ${current.monthlyGrossSalary.toLocaleString()}`,
        newValue: `KES ${next.monthlyGrossSalary.toLocaleString()}`,
        actorName: actor,
      });
    }
    if (current.jobTitle !== next.jobTitle) {
      const wasPromotion =
        next.monthlyGrossSalary >= current.monthlyGrossSalary;
      await ctx.db.insert("employeeEvents", {
        employeeId: args.id,
        eventType: wasPromotion ? "promoted" : "transferred",
        effectiveDate: today,
        detail: `Role: ${current.jobTitle} → ${next.jobTitle}`,
        oldValue: current.jobTitle,
        newValue: next.jobTitle,
        actorName: actor,
      });
    }
    if (current.departmentId !== next.departmentId) {
      const oldDept = await ctx.db.get(current.departmentId);
      const newDept = await ctx.db.get(next.departmentId);
      await ctx.db.insert("employeeEvents", {
        employeeId: args.id,
        eventType: "transferred",
        effectiveDate: today,
        detail: "Department transfer",
        oldValue: oldDept?.name ?? "—",
        newValue: newDept?.name ?? "—",
        actorName: actor,
      });
    }
    if ((current.managerName ?? "") !== (next.managerName ?? "")) {
      await ctx.db.insert("employeeEvents", {
        employeeId: args.id,
        eventType: "manager_changed",
        effectiveDate: today,
        detail: "Reporting manager changed",
        oldValue: current.managerName ?? "—",
        newValue: next.managerName ?? "—",
        actorName: actor,
      });
    }
    if (current.status !== next.status) {
      await ctx.db.insert("employeeEvents", {
        employeeId: args.id,
        eventType: "status_changed",
        effectiveDate: today,
        detail: "Employment status changed",
        oldValue: current.status.replace("_", " "),
        newValue: next.status.replace("_", " "),
        actorName: actor,
      });
    }
    if (current.employmentType !== next.employmentType) {
      await ctx.db.insert("employeeEvents", {
        employeeId: args.id,
        eventType: "employee_updated",
        effectiveDate: today,
        detail: "Contract type changed",
        oldValue: current.employmentType,
        newValue: next.employmentType,
        actorName: actor,
      });
    }

    return args.id;
  },
});

/** Offboarding sets status + exit date and logs the exit. Records are retained. */
export const offboard = mutation({
  args: {
    id: v.id("employees"),
    effectiveDate: v.string(),
    reason: v.string(),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Employee not found");
    if (current.status === "offboarded") {
      throw new Error("Employee is already offboarded.");
    }

    await ctx.db.patch(args.id, { status: "offboarded", exitDate: args.effectiveDate });
    await ctx.db.insert("employeeEvents", {
      employeeId: args.id,
      eventType: "offboarded",
      effectiveDate: args.effectiveDate,
      detail: args.reason.trim() || "Employment ended",
      oldValue: current.status.replace("_", " "),
      newValue: "offboarded",
      actorName: args.actorName,
    });
    return args.id;
  },
});
