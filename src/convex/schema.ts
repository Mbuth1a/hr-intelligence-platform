import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---------------------------------------------------------------------------
// KIFARU-PF-FS-001 v1 — Employee Records (scope: one HR team)
// Person model is realised as the Employee master record. Per P2/P3, every
// consequential change is recorded as an immutable EmployeeEvent with the
// old and new values so historical states remain reconstructable.
// ---------------------------------------------------------------------------

export const EMPLOYMENT_TYPES = [
  "permanent",
  "fixed-term",
  "internship",
  "contract",
] as const;
export const employmentTypeValidator = v.union(
  ...EMPLOYMENT_TYPES.map((t) => v.literal(t)),
);
export type EmploymentType = Infer<typeof employmentTypeValidator>;

export const EMPLOYEE_STATUSES = [
  "active",
  "probation",
  "on_leave",
  "offboarded",
] as const;
export const employeeStatusValidator = v.union(
  ...EMPLOYEE_STATUSES.map((t) => v.literal(t)),
);
export type EmployeeStatus = Infer<typeof employeeStatusValidator>;

export const EVENT_TYPES = [
  "hired",
  "salary_changed",
  "promoted",
  "transferred",
  "manager_changed",
  "status_changed",
  "employee_updated",
  "offboarded",
] as const;
export const eventTypeValidator = v.union(...EVENT_TYPES.map((t) => v.literal(t)));
export type EmployeeEventType = Infer<typeof eventTypeValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      // Login ↔ employee linkage (spec §7: Person ≠ User Account, but a user
      // account can be granted access to an employee self-service record)
      employeeId: v.optional(v.id("employees")),
    }).index("email", ["email"]),

    // Organizational unit (v1: departments within one legal entity)
    departments: defineTable({
      name: v.string(),
      code: v.string(),
      monthlyBudget: v.optional(v.number()), // KES per month
    })
      .index("by_code", ["code"])
      .index("by_name", ["name"]),

    // Employee master record (canonical source, P1)
    employees: defineTable({
      employeeNumber: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      jobTitle: v.string(),
      departmentId: v.id("departments"),
      employmentType: employmentTypeValidator,
      status: employeeStatusValidator,
      hireDate: v.string(), // ISO yyyy-mm-dd
      exitDate: v.optional(v.string()),
      monthlyGrossSalary: v.number(), // KES
      managerName: v.optional(v.string()),
      location: v.optional(v.string()),
    })
      .index("by_status", ["status"])
      .index("by_department", ["departmentId"])
      .index("by_number", ["employeeNumber"])
      .index("by_email", ["email"]),

    // Immutable history log (P2 — historical records are preserved)
    employeeEvents: defineTable({
      employeeId: v.id("employees"),
      eventType: eventTypeValidator,
      effectiveDate: v.string(), // ISO yyyy-mm-dd
      detail: v.string(),
      oldValue: v.optional(v.string()),
      newValue: v.optional(v.string()),
      actorName: v.optional(v.string()),
    }).index("by_employee", ["employeeId"]),

    // ---------------- Payroll (spec §37–48) ----------------

    // Versioned, effective-dated statutory rules (BR-007)
    statutoryRules: defineTable({
      version: v.number(),
      jurisdiction: v.string(),
      effectiveFrom: v.string(),
      packageJson: v.string(), // serialized StatutoryRulePackage
    }).index("by_version", ["version"]),

    // Payroll periods (spec §38)
    payrollPeriods: defineTable({
      periodLabel: v.string(), // e.g. "2026-08"
      startDate: v.string(),
      endDate: v.string(),
      payDate: v.string(),
      frequency: v.literal("monthly"),
      status: v.union(
        v.literal("OPEN"),
        v.literal("CALCULATED"),
        v.literal("UNDER_REVIEW"),
        v.literal("APPROVED"),
        v.literal("LOCKED"),
      ),
      ruleVersion: v.number(),
      totals: v.optional(
        v.object({
          employees: v.number(),
          gross: v.number(),
          net: v.number(),
          paye: v.number(),
          nssf: v.number(),
          shif: v.number(),
          ahl: v.number(),
          employerCost: v.number(),
        }),
      ),
      validationReport: v.optional(
        v.object({
          processed: v.number(),
          successful: v.number(),
          warnings: v.number(),
          blockingErrors: v.number(),
          messages: v.array(v.string()),
        }),
      ),
      approvedBy: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      lockedBy: v.optional(v.string()),
      lockedAt: v.optional(v.number()),
      journalRef: v.optional(v.string()),
    }).index("by_label", ["periodLabel"]),

    // Payslips — immutable once the period is locked (spec §45)
    payslips: defineTable({
      periodId: v.id("payrollPeriods"),
      periodLabel: v.string(),
      employeeId: v.id("employees"),
      employeeNumber: v.string(),
      reference: v.string(), // unique payslip reference
      grossPay: v.number(),
      taxablePay: v.number(),
      paye: v.number(),
      nssf: v.number(),
      shif: v.number(),
      ahl: v.number(),
      totalDeductions: v.number(),
      netPay: v.number(),
      employerCost: v.number(),
      lines: v.array(
        v.object({
          code: v.string(),
          label: v.string(),
          amount: v.number(),
          type: v.string(),
          source: v.string(),
        }),
      ),
      warnings: v.array(v.string()),
    })
      .index("by_period", ["periodId"])
      .index("by_reference", ["reference"])
      .index("by_employee", ["employeeId"]),

    // Flagged records requiring HR action (spec §42 + P4 — human approval)
    payrollFlags: defineTable({
      periodId: v.id("payrollPeriods"),
      periodLabel: v.string(),
      employeeId: v.id("employees"),
      employeeNumber: v.string(),
      employeeName: v.string(),
      reason: v.string(),
      severity: v.union(v.literal("warning"), v.literal("blocking")),
      status: v.union(
        v.literal("pending"),
        v.literal("go_ahead"),
        v.literal("hold"),
        v.literal("review"),
      ),
      decidedBy: v.optional(v.string()),
      decidedAt: v.optional(v.number()),
      note: v.optional(v.string()),
    })
      .index("by_period", ["periodId"])
      .index("by_status", ["status"]),

    // ---------------- Self-service (spec §28, §35) ----------------

    // Leave types are configurable (spec §28)
    leaveTypes: defineTable({
      name: v.string(),
      code: v.string(),
      annualEntitlementDays: v.number(),
      maxCarryForwardDays: v.number(),
      requiresProbationWait: v.boolean(),
    }).index("by_code", ["code"]),

    // Leave balances, computed from requests + accrual (spec §29)
    leaveBalances: defineTable({
      employeeId: v.id("employees"),
      year: v.number(),
      leaveTypeCode: v.string(),
      entitled: v.number(),
      carriedForward: v.number(),
      daysTaken: v.number(),
    })
      .index("by_employee_year", ["employeeId", "year"])
      .index("by_employee_type", ["employeeId", "leaveTypeCode"]),

    // Leave requests: employee → balance validation → manager/HR → calendar (spec §28)
    leaveRequests: defineTable({
      employeeId: v.id("employees"),
      leaveTypeCode: v.string(),
      startDate: v.string(), // ISO
      endDate: v.string(), // ISO inclusive
      days: v.number(),
      reason: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled"),
      ),
      decidedBy: v.optional(v.string()),
      decidedAt: v.optional(v.number()),
      decisionNote: v.optional(v.string()),
    })
      .index("by_employee", ["employeeId"])
      .index("by_status", ["status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
