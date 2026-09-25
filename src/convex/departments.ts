import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/** List all departments with live headcount (employees not offboarded). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const departments = await ctx.db.query("departments").collect();
    const employees = await ctx.db.query("employees").collect();

    return departments
      .map((d) => ({
        ...d,
        headcount: employees.filter(
          (e) => e.departmentId === d._id && e.status !== "offboarded",
        ).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    monthlyBudget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const name = args.name.trim();
    const code = args.code.trim().toUpperCase();
    if (!name || !code) throw new Error("Name and code are required.");

    const existing = await ctx.db.query("departments").collect();
    if (existing.some((d) => d.code === code)) {
      throw new Error(`Department code "${code}" already exists.`);
    }

    return await ctx.db.insert("departments", {
      name,
      code,
      monthlyBudget: args.monthlyBudget && args.monthlyBudget > 0 ? args.monthlyBudget : undefined,
    });
  },
});
