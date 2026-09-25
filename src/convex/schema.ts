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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
