import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { formatKES } from "@/lib/format";
import {
  ArrowUpRight,
  Cake,
  Loader2,
  MapPin,
  TrendingUp,
  UserPlus,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { useSeedOnce } from "@/hooks/use-seed-once";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short" });
}

export default function EmployeesDashboard() {
  const data = useQuery(api.employees.dashboard, {});
  useSeedOnce();

  if (data === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const movement = data.months.map((m) => ({
    month: monthLabel(m.label),
    hires: m.hires,
    exits: m.exits,
  }));

  const tenureData = [
    { bucket: "< 1 yr", count: data.tenureBuckets["0-1"] },
    { bucket: "1–3 yrs", count: data.tenureBuckets["1-3"] },
    { bucket: "3–5 yrs", count: data.tenureBuckets["3-5"] },
    { bucket: "5+ yrs", count: data.tenureBuckets["5+"] },
  ];

  const locationColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Employees module</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">People dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Workforce movement, tenure, contracts and records at a glance.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to="/employees">
            <Users className="size-4" />
            Manage records
          </Link>
        </Button>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Users,
            label: "Headcount",
            value: String(data.headcount),
            sub: `${data.offboardedCount} offboarded (retained)`,
          },
          {
            icon: UserPlus,
            label: "New hires (90d)",
            value: String(data.recentHires.length),
            sub: "See recent joiners below",
          },
          {
            icon: TrendingUp,
            label: "Avg salary",
            value: formatKES(data.salaryStats.avg, { compact: true }),
            sub: `median ${formatKES(data.salaryStats.median, { compact: true })}`,
          },
          {
            icon: Wallet,
            label: "Salary range",
            value: formatKES(data.salaryStats.min, { compact: true }),
            sub: `up to ${formatKES(data.salaryStats.max, { compact: true })}`,
          },
        ].map((k) => (
          <Card key={k.label} className="glass-hover">
            <CardContent className="flex items-start gap-4 px-5 pt-5 sm:px-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.16)] to-[oklch(0.6_0.09_190_/_0.16)] text-primary">
                <k.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {k.label}
                </p>
                <p className="mt-1 truncate text-2xl font-bold tracking-tight">{k.value}</p>
                {k.sub && <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workforce movement — 12 months</CardTitle>
            <CardDescription>Hires vs exits per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movement} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.4 0.02 250 / 0.12)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "oklch(0.5 0.025 245)" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: "oklch(0.5 0.025 245)" }} />
                  <RechartsTooltip
                    cursor={{ fill: "oklch(0.5 0.02 250 / 0.06)" }}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid oklch(1 0 0 / 80%)",
                      background: "oklch(0.995 0.004 235 / 92%)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="hires" name="Hires" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="exits" name="Exits" fill="oklch(0.75 0.03 250)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenure mix</CardTitle>
            <CardDescription>Distribution of service years</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tenureData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="tenureGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.4 0.02 250 / 0.12)" />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "oklch(0.5 0.025 245)" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: "oklch(0.5 0.025 245)" }} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid oklch(1 0 0 / 80%)",
                      background: "oklch(0.995 0.004 235 / 92%)",
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="count" name="People" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#tenureGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Recent hires */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent joiners</CardTitle>
            <CardDescription>Last 90 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentHires.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hires in the last 90 days.</p>
            ) : (
              data.recentHires.map((h) => (
                <div key={h.employeeNumber} className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.18)] to-[oklch(0.6_0.09_190_/_0.18)] text-[10px] font-bold text-primary">
                    {h.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {h.jobTitle} · {new Date(h.hireDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Anniversaries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="size-4 text-primary" />
              Work anniversaries
            </CardTitle>
            <CardDescription>Next 45 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingAnniversaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No anniversaries in the next 45 days.</p>
            ) : (
              data.upcomingAnniversaries.map((a) => (
                <div key={a.employeeNumber + a.date} className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <Badge variant="secondary" className="rounded-lg bg-white/60 text-xs font-bold">
                    {a.years}y
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {a.daysAway === 0 ? "today 🎉" : `in ${a.daysAway}d`}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Probation watch */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Probation watch</CardTitle>
            <CardDescription>Confirm or extend soon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.probation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody is on probation.</p>
            ) : (
              data.probation.map((p) => (
                <div key={p.employeeNumber} className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.jobTitle}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full border ${p.monthsIn >= 6 ? "bg-amber-500/15 text-amber-700 border-amber-500/25" : "bg-white/60"}`}
                  >
                    {p.monthsIn} mo in
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Locations strip */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" />
            By location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.byLocation.map((l, i) => (
              <Badge
                key={l.name}
                variant="outline"
                className="rounded-full bg-white/55 px-3 py-1.5 text-sm"
              >
                <span
                  className="mr-1.5 size-2 rounded-full"
                  style={{ background: locationColors[i % locationColors.length] }}
                />
                {l.name}
                <span className="ml-1.5 font-bold">{l.count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowUpRight className="size-3.5" />
        Manage individual records, history and offboarding on the Employees page.
      </p>
    </AppShell>
  );
}
