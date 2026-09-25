"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { vly } from "../lib/vly-integrations";
import { getAuthUserId } from "@convex-dev/auth/server";

type CopilotContext = {
  asOfDate: string;
  currency: string;
  totals: {
    headcount: number;
    monthlyGrossPayrollKES: number;
    avgSalaryKES: number;
    offboardedTotal: number;
    recentHires90d: number;
  };
  statusMix: { active: number; probation: number; onLeave: number };
  contractMix: {
    permanent: number;
    fixedTerm: number;
    internship: number;
    contract: number;
  };
  departments: {
    name: string;
    code: string;
    headcount: number;
    monthlyCostKES: number;
    avgSalaryKES: number;
    monthlyBudgetKES: number | null;
    budgetUtilisation: number | null;
  }[];
  employees: {
    name: string;
    number: string;
    department: string;
    jobTitle: string;
    employmentType: string;
    status: string;
    hireDate: string;
    exitDate: string | null;
    tenureMonths: number;
    monthlySalaryKES: number;
    salaryVsDeptAvgPct: number;
  }[];
  recentEvents: {
    employee: string;
    type: string;
    effectiveDate: string;
    detail: string;
    oldValue: string | null;
    newValue: string | null;
    recordedBy: string | null;
  }[];
};

/** Single chat turn: authorized → validated analytics context → LLM → answer. */
export const askCopilot = action({
  args: {
    question: v.string(),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // Authorization (spec §53): never answer without a signed-in user
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const question = args.question.trim();
    if (!question) throw new Error("Please ask a question.");
    if (question.length > 600) throw new Error("Question is too long.");

    // Validated analytics context (never raw production tables)
    const context = (await ctx.runQuery(
      internal.analytics.copilotContext,
      {},
    )) as CopilotContext;

    const system = [
      "You are the Kifaru Copilot, the AI assistant inside the Kifaru HR & Payroll Intelligence platform.",
      "You answer questions about one organization's workforce using ONLY the JSON context provided.",
      "Currency is Kenyan Shillings (KES); state figures in KES and use thousands separators.",
      "Ground every claim in the data. Cite employee names/numbers, department names, dates and event details where relevant.",
      "If the context does not contain the answer, say so plainly and suggest what data would be needed.",
      "Never invent employees, departments, salaries or events.",
      "Business rules you must respect: AI may inform but never make consequential employment decisions (e.g. never recommend firing someone).",
      "When asked about efficiency or performance, remember the data available is: salary, tenure, department, contract type, status, and change history; performance scores are not in scope yet.",
      "Answer in 2-5 short paragraphs maximum, or a compact bullet list. Be direct and executive-ready.",
    ].join(" ");

    const contextJson = JSON.stringify(context);

    const messages: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "WORKFORCE ANALYTICS CONTEXT (authoritative JSON):\n" +
          contextJson +
          "\n\nUse this data to answer the user's question below.",
      },
      ...(args.history ?? []).slice(-6),
      { role: "user", content: question },
    ];

    const result = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      maxTokens: 900,
    });

    if (!result.success || !result.data) {
      throw new Error(
        result.error ?? "The AI service is unavailable. Please try again.",
      );
    }

    const answer = result.data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("The AI returned an empty answer.");

    return { answer };
  },
});
