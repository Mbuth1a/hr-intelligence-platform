import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireEmployee(
  ctx: any,
): Promise<{ userId: string; user: Doc<"users">; employee: Doc<"employees"> }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Unauthenticated");
  if (!user.employeeId) {
    throw new Error(
      "This account is not linked to an employee record. Ask HR to link it.",
    );
  }
  const employee = await ctx.db.get(user.employeeId);
  if (!employee) throw new Error("Linked employee record no longer exists.");
  return { userId, user, employee };
}

/**
 * Resolve the signed-in user's linked employee, or null when the account is
 * not linked. Queries use this to degrade gracefully (no crash for HR/admin
 * accounts that aren't employees); mutations throw instead.
 */
async function getLinkedEmployee(
  ctx: { db: { get(id: unknown): Promise<unknown> } },
): Promise<{
  user: { _id: unknown; email?: string; employeeId?: unknown };
  employee: Doc<"employees">;
} | null> {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) return null;
  const user = (await ctx.db.get(userId)) as {
    _id: unknown;
    email?: string;
    employeeId?: unknown;
  } | null;
  if (!user?.employeeId) return null;
  const employee = (await ctx.db.get(user.employeeId)) as Doc<"employees"> | null;
  if (!employee) return null;
  return { user, employee };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Inclusive business-day count (skip Sat/Sun) between two ISO dates. */
export function workingDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function ensureBalance(
  ctx: any,
  employeeId: Id<"employees">,
  year: number,
  type: Doc<"leaveTypes">,
): Promise<Doc<"leaveBalances">> {
  const existing = await ctx.db
    .query("leaveBalances")
    .withIndex("by_employee_type", (q: any) =>
      q.eq("employeeId", employeeId).eq("leaveTypeCode", type.code),
    )
    .first();
  if (existing) return existing;

  // Accrual (spec §29): simple monthly accrual = entitlement / 12 per worked
  // month of service this year; carried forward capped by policy.
  const emp = await ctx.db.get(employeeId);
  const hire = new Date(emp.hireDate + "T00:00:00Z");
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const accrualStart = hire > yearStart ? hire : yearStart;
  const now = new Date();
  const yearEnd =
    year === now.getUTCFullYear() ? now : new Date(Date.UTC(year, 11, 31));
  const monthsWorked = Math.max(
    0,
    (yearEnd.getUTCFullYear() - accrualStart.getUTCFullYear()) * 12 +
      (yearEnd.getUTCMonth() - accrualStart.getUTCMonth()),
  );
  const entitled = Math.round((type.annualEntitlementDays / 12) * monthsWorked * 10) / 10;
  const carriedForward = year > new Date().getUTCFullYear() ? 0 : Math.min(type.maxCarryForwardDays, type.annualEntitlementDays);

  const id = await ctx.db.insert("leaveBalances", {
    employeeId,
    year,
    leaveTypeCode: type.code,
    entitled: type.requiresProbationWait && emp.status === "probation" ? 0 : entitled,
    carriedForward,
    daysTaken: 0,
  });
  return await ctx.db.get(id);
}

// ---------------------------------------------------------------------------
// Queries — all scoped to the signed-in employee (BR-004/BR-005)
// ---------------------------------------------------------------------------

/** My leave balances for the current year. */
export const myLeaveBalances = query({
  args: {},
  handler: async (ctx) => {
    const linked = await getLinkedEmployee(ctx);
    if (!linked) return [];
    const { employee } = linked;
    const year = new Date().getUTCFullYear();
    const types = await ctx.db.query("leaveTypes").collect();
    const balances = [];
    for (const t of types.sort((a, b) => a.code.localeCompare(b.code))) {
      const b = await ensureBalance(ctx, employee._id, year, t);
      balances.push({
        ...b,
        typeName: t.name,
        available: Math.max(0, b.entitled + b.carriedForward - b.daysTaken),
      });
    }
    return balances;
  },
});

/** My leave requests, newest first. */
export const myLeaveRequests = query({
  args: {},
  handler: async (ctx) => {
    const linked = await getLinkedEmployee(ctx);
    if (!linked) return [];
    const { employee } = linked;
    const rows = await ctx.db
      .query("leaveRequests")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();
    return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

/** My employment status snapshot for the self-service home. */
export const myEmploymentStatus = query({
  args: {},
  handler: async (ctx) => {
    const linked = await getLinkedEmployee(ctx);
    if (!linked) return null;
    const { user, employee } = linked;
    const dept = (await ctx.db.get(employee.departmentId)) as Doc<"departments"> | null;
    const events = await ctx.db
      .query("employeeEvents")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();
    const recent = events
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
      .slice(0, 5);

    const year = new Date().getUTCFullYear();
    const requests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();
    const pending = requests.filter((r) => r.status === "pending").length;
    const approvedUpcoming = requests.filter(
      (r) => r.status === "approved" && r.startDate >= todayISO(),
    ).length;

    return {
      linkedEmail: user.email ?? "",
      employeeNumber: employee.employeeNumber,
      name: `${employee.firstName} ${employee.lastName}`,
      jobTitle: employee.jobTitle,
      department: dept?.name ?? "—",
      employmentType: employee.employmentType,
      status: employee.status,
      hireDate: employee.hireDate,
      managerName: employee.managerName ?? null,
      location: employee.location ?? null,
      monthlyGrossSalary: employee.monthlyGrossSalary,
      recentEvents: recent,
      leave: { pending, approvedUpcoming },
    };
  },
});

/** HR view: all leave requests across the org, newest first. */
export const allLeaveRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const requests = await ctx.db.query("leaveRequests").collect();
    const employees = await ctx.db.query("employees").collect();
    const byId = new Map(employees.map((e) => [e._id, e]));
    return requests
      .map((r) => {
        const e = byId.get(r.employeeId);
        return {
          ...r,
          employeeName: e ? `${e.firstName} ${e.lastName}` : "(ex-employee)",
          employeeNumber: e?.employeeNumber ?? "—",
          department: e?.jobTitle ?? "",
        };
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Apply for leave (spec §28 workflow: employee request → balance check → HR). */
export const applyLeave = mutation({
  args: {
    leaveTypeCode: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { employee } = await requireEmployee(ctx);
    if (employee.status === "offboarded") {
      throw new Error("Offboarded employees cannot apply for leave.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(args.endDate)) {
      throw new Error("Dates must be valid (YYYY-MM-DD).");
    }
    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after the start date.");
    }
    if (args.startDate < todayISO()) {
      throw new Error("Leave cannot start in the past.");
    }

    const type = await ctx.db
      .query("leaveTypes")
      .withIndex("by_code", (q) => q.eq("code", args.leaveTypeCode))
      .first();
    if (!type) throw new Error("Unknown leave type.");

    // Balance validation (spec §28)
    const year = new Date(args.startDate + "T00:00:00Z").getUTCFullYear();
    const balance = await ensureBalance(ctx, employee._id, year, type);
    const days = workingDaysBetween(args.startDate, args.endDate);
    if (days <= 0) throw new Error("Selected range contains no working days.");
    const available = balance.entitled + balance.carriedForward - balance.daysTaken;
    if (days > available) {
      throw new Error(
        `Insufficient balance: requesting ${days} working day(s) but only ${available} available.`,
      );
    }
    if (type.requiresProbationWait && employee.status === "probation") {
      throw new Error(
        `${type.name} is not available during probation. Contact HR with special requests.`,
      );
    }

    // Overlap check against pending/approved leave
    const existing = await ctx.db
      .query("leaveRequests")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();
    const overlaps = existing.some(
      (r) =>
        (r.status === "pending" || r.status === "approved") &&
        args.startDate <= r.endDate &&
        args.endDate >= r.startDate,
    );
    if (overlaps) {
      throw new Error("You already have pending or approved leave overlapping these dates.");
    }

    return await ctx.db.insert("leaveRequests", {
      employeeId: employee._id,
      leaveTypeCode: type.code,
      startDate: args.startDate,
      endDate: args.endDate,
      days,
      reason: args.reason?.trim() || undefined,
      status: "pending",
    });
  },
});

/** Cancel my own pending request. */
export const cancelMyLeave = mutation({
  args: { requestId: v.id("leaveRequests") },
  handler: async (ctx, args) => {
    const { employee } = await requireEmployee(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");
    if (request.employeeId !== employee._id) {
      throw new Error("You can only cancel your own requests.");
    }
    if (request.status !== "pending") {
      throw new Error("Only pending requests can be cancelled.");
    }
    await ctx.db.patch(args.requestId, { status: "cancelled" });
    return args.requestId;
  },
});

/** HR decision on a leave request; updates the balance when approved (spec §28→§29). */
export const decideLeave = mutation({
  args: {
    requestId: v.id("leaveRequests"),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
    ),
    note: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");
    if (request.status !== "pending") {
      throw new Error("Request already decided.");
    }

    if (args.decision === "approved") {
      // Re-validate balance at decision time
      const type = await ctx.db
        .query("leaveTypes")
        .withIndex("by_code", (q) => q.eq("code", request.leaveTypeCode))
        .first();
      if (!type) throw new Error("Unknown leave type.");
      const year = new Date(request.startDate + "T00:00:00Z").getUTCFullYear();
      const balance = await ensureBalance(ctx, request.employeeId, year, type);
      const available = balance.entitled + balance.carriedForward - balance.daysTaken;
      if (request.days > available) {
        throw new Error(
          `Cannot approve: balance now ${available} day(s) but request needs ${request.days}.`,
        );
      }
      await ctx.db.patch(balance._id, { daysTaken: balance.daysTaken + request.days });
    }

    await ctx.db.patch(args.requestId, {
      status: args.decision,
      decidedBy: args.actorName ?? "HR",
      decidedAt: Date.now(),
      decisionNote: args.note?.trim() || undefined,
    });

    // Employee event log for approved leave (P2 — history preserved)
    if (args.decision === "approved") {
      await ctx.db.insert("employeeEvents", {
        employeeId: request.employeeId,
        eventType: "status_changed",
        effectiveDate: request.startDate,
        detail: `Leave approved: ${request.leaveTypeCode} (${request.days} working days)`,
        actorName: args.actorName ?? "HR",
      });
    }

    return args.requestId;
  },
});

/** Link the CURRENTLY signed-in account (email or guest) to an employee. */
export const linkSelfToEmployee = mutation({
  args: {
    employeeId: v.id("employees"),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Unauthenticated");

    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Employee not found.");

    const allUsers = await ctx.db.query("users").collect();
    const clash = allUsers.find(
      (u) => u.employeeId === args.employeeId && u._id !== user._id,
    );
    if (clash) {
      throw new Error(
        `Employee already linked to another account (${clash.email ?? clash._id}).`,
      );
    }

    await ctx.db.patch(user._id, { employeeId: args.employeeId });
    return user._id;
  },
});

/** HR: link a user account (by email) to an employee record. */
export const linkUserToEmployee = mutation({
  args: {
    userEmail: v.string(),
    employeeId: v.id("employees"),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail.trim().toLowerCase()))
      .first();
    if (!user) throw new Error(`No user account found for ${args.userEmail}.`);

    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Employee not found.");

    // One account ↔ one employee; one employee ↔ at most one account
    const allUsers = await ctx.db.query("users").collect();
    const clash = allUsers.find(
      (u) => u.employeeId === args.employeeId && u._id !== user._id,
    );
    if (clash) {
      throw new Error(
        `Employee already linked to another account (${clash.email ?? clash._id}).`,
      );
    }

    await ctx.db.patch(user._id, { employeeId: args.employeeId });
    return user._id;
  },
});

/** Seed default Kenyan-style leave types (idempotent, HR-initiated). */
export const seedLeaveTypes = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db.query("leaveTypes").collect();
    if (existing.length > 0) return { seeded: false as const };
    for (const t of [
      { name: "Annual leave", code: "ANN", annualEntitlementDays: 21, maxCarryForwardDays: 10, requiresProbationWait: true },
      { name: "Sick leave", code: "SICK", annualEntitlementDays: 14, maxCarryForwardDays: 0, requiresProbationWait: false },
      { name: "Compassionate leave", code: "COMP", annualEntitlementDays: 5, maxCarryForwardDays: 0, requiresProbationWait: false },
      { name: "Study leave", code: "STUDY", annualEntitlementDays: 10, maxCarryForwardDays: 0, requiresProbationWait: true },
    ]) {
      await ctx.db.insert("leaveTypes", t);
    }
    return { seeded: true as const };
  },
});
