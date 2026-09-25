import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSeedOnce } from "@/hooks/use-seed-once";
// payroll trend comes from processed runs (api.payroll.periods)
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CalendarClock,
  Loader2,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { formatKES, formatTenure } from "@/lib/format";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useMemo } from "react";

const statusColors: Record<string, string> = {
  active: "var(--chart-1)",
  probation: "var(--chart-4)",
  on_leave: "var(--chart-3)",
  offboarded: "oklch(0.75 0.02 250)",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "teal" | "violet";
}) {
  const accents: Record<string, string> = {
    primary: "from-[oklch(0.5_0.1_230_/_0.16)] to-[oklch(0.6_0.09_190_/_0.16)] text-primary",
    teal: "from-[oklch(0.6_0.09_195_/_0.18)] to-[oklch(0.7_0.09_170_/_0.18)] text-[oklch(0.45_0.08_195)]",
    violet: "from-[oklch(0.6_0.09_265_/_0.16)] to-[oklch(0.65_0.08_290_/_0.16)] text-[oklch(0.45_0.08_265)]",
  };
  return (
    <Card className="glass-hover">
      <CardContent className="flex items-start gap-4 px-5 pt-5 sm:px-6">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accents[accent]}`}
        >
          <Icon className="size-5" />
  </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-[1.7rem]">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const summary = useQuery(api.employees.summary, {});
  const payrollPeriods = useQuery(api.payroll.periods, {});
  useSeedOnce();

  const trendData = useMemo(() => {
    // Prefer actual processed payroll runs (traceable totals) when available
    const real = (payrollPeriods ?? [])
      .filter((p) => p.totals && p.totals.employees > 0)
      .sort((a, b) => a.periodLabel.localeCompare(b.periodLabel))
      .slice(-6)
      .map((p) => ({ month: p.periodLabel.slice(2), cost: Math.round(p.totals!.gross) }));
    if (real.length > 0) return real;
    if (!summary) return [];
    return summary.months.map((m) => ({
      month: m.label,
      cost: Math.round(m.cost),
    }));
  }, [summary, payrollPeriods]);

  const statusMix = useMemo(() => {
    if (!summary) return [];
    return (
      Object.entries(summary.byStatus) as [string, number][]
    ).map(([status, count]) => ({
      status,
      count,
      label: EMPLOYEE_STATUS_LABELS[status] ?? status,
    }));
  }, [summary]);

  const typeMix = useMemo(() => {
    if (!summary) return [];
    return (
      Object.entries(summary.byType) as [string, number][]
    ).map(([type, count]) => ({
      type,
      count,
      label: EMPLOYMENT_TYPE_LABELS[type] ?? type,
    }));
  }, [summary]);

  if (summary === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
  );
  }

  return (
    <AppShell>
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Headcount &amp; cost summary
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ""} — here is your workforce at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="rounded-xl">
            <Link to="/employees">
              <UserPlus className="size-4" />
              Add employee
            </Link>
          </Button>
          <Button asChild variant="outline" className="glass-subtle rounded-xl">
            <Link to="/employees">
              View records
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row — the must-have summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Headcount"
          value={String(summary.headcount)}
          sub={`${summary.recentHires} joined in last 90 days`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Monthly gross cost"
          value={formatKES(summary.monthlyCost, { compact: true })}
          sub={`${formatKES(summary.avgSalary, { compact: true })} average salary`}
          accent="teal"
        />
        <KpiCard
          icon={CalendarClock}
          label="Avg tenure"
          value={formatTenure(Math.round(summary.avgTenureMonths))}
          sub={`${summary.byStatus.probation} on probation`}
          accent="violet"
        />
        <KpiCard
          icon={UserMinus}
          label="Offboarded"
          value={String(summary.offboardedCount)}
          sub="Records retained"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Payroll cost trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payroll cost trend</CardTitle>
            <CardDescription>
              Total monthly gross salary cost, last 6 months (KES)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.4 0.02 250 / 0.12)" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "oklch(0.5 0.025 245)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={{ fontSize: 11, fill: "oklch(0.5 0.025 245)" }}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}K`}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "oklch(0.5 0.02 250 / 0.06)" }}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid oklch(1 0 0 / 80%)",
                      background: "oklch(0.995 0.004 235 / 92%)",
                      boxShadow: "0 12px 32px -12px oklch(0.45 0.07 235 / 0.3)",
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatKES(Number(value)), "Gross cost"]}
                  />
                  <Bar dataKey="cost" radius={[8, 8, 0, 0]} fill="var(--chart-1)" maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status & contract mix */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {statusMix.map((s) => (
                <div key={s.status} className="flex items-center gap-3">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: statusColors[s.status] }}
                  />
                  <span className="flex-1 text-sm">{s.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{s.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contract mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {typeMix.map((t) => (
                <div key={t.type} className="flex items-center gap-3">
                  <Badge variant="secondary" className="rounded-lg bg-white/60">
                    {t.label}
                  </Badge>
                  <span className="ml-auto text-sm font-semibold tabular-nums">{t.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Department cost breakdown */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Headcount &amp; cost by department</CardTitle>
            <CardDescription>Monthly gross cost rollup across the organization</CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-lg bg-white/60 text-xs">
            {summary.byDepartment.length} departments
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary.byDepartment.map((d) => {
              const max = Math.max(...summary.byDepartment.map((x) => x.monthlyCost), 1);
              const share = summary.monthlyCost ? d.monthlyCost / summary.monthlyCost : 0;
              return (
                <div key={d.departmentId} className="glass-subtle rounded-2xl p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{d.name}</p>
                        <Badge variant="outline" className="rounded-md bg-white/50 text-[10px] uppercase tracking-wide">
                          {d.code}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.headcount} {d.headcount === 1 ? "person" : "people"} · avg {formatKES(d.avgSalary, { compact: true })}
                        {d.budget != null && ` · budget ${formatKES(d.budget, { compact: true })}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">
                        {formatKES(d.monthlyCost, { compact: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(share * 100).toFixed(1)}% of payroll
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[oklch(0.48_0.09_230)] to-[oklch(0.62_0.09_195)]"
                      style={{ width: `${Math.max(share * 100, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
