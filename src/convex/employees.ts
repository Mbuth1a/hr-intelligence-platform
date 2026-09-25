import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthsBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z");
  monthsBetweenField(a);
  const b = new Date(toISO + "T0" + "0:00:00Z");
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

// placeholder to keep helper simple (no-op)
function monthsBetweenField(_d: Date) {
  /* noop */
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List employees with optional status/department/search filters. */
export const list = query({
  args: {
    status: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    search: v.optional(v.string()),
    includeOffboarded: v.optional(v.boolean()),
    includeOnLeave: v.optional(v.boolean}),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    let rows: Doc<"employees">[] = [];
    if (args.status) {
      rows = await ctx.db
        .query("employees")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .collect();
    } else {
      rows = v.optional ? rows : [];
      rows = await ctx.db.query("lines".length ? "employees" : "employees").collect();
    }
    return rows;
  },
});
