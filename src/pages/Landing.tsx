import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FileClock,
  Layers,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import kifaruLogo from "@/assets/kifaru-logo.svg";
import { Link } from "react-router";

const lifecycle = [
  "Plan",
  "Recruit",
  "Hire",
  "Onboard",
  "Employ",
  "Manage",
  "Attend",
  "Leave",
  "Perform",
  "Develop",
  "Compensate",
  "Pay",
  "Analyze",
  "Predict",
  "Exit",
  "Retain",
];

const pillars = [
  {
    icon: Layers,
    title: "One source of truth",
    body: "Person → Employment → Position → Compensation. Payroll consumes canonical employee data, never a shadow copy.",
  },
  {
    icon: FileClock,
    title: "History is preserved",
    body: "Every salary, role, department and contract change is kept as an immutable event — ask what anyone earned on any date.",
  },
  {
    icon: CalendarClock,
    title: "Effective dating",
    body: "Records carry effective_from and effective_to, so the past is reconstructable and the future can be pre-agreed.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval",
    body: "AI may flag, forecast and recommend — consequential employment decisions always remain with people.",
  },
];

const stats = [
  { value: "16", label: "lifecycle stages, plan → retain" },
  { value: "100%", label: "of consequential changes audited" },
  { value: "KES", label: "native payroll currency, Kenya-first" },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden glass-canvas">
      {/* Soft color fields */}
      <div className="pointer-events-none absolute inset-0">
        <div className="glass-blob left-[-10%] top-[-12%] h-[28rem] w-[28rem] bg-[oklch(0.84_0.08_220)]" />
        <div className="glass-blob right-[-8%] top-[6%] h-[24rem] w-[24rem] bg-[oklch(0.87_0.07_190)]" />
        <div className="glass-blob bottom-[-18%] left-[30%] h-[30rem] w-[30rem] bg-[oklch(0.87_0.06_255)]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 px-4 pt-5 sm:px-8">
        <div className="glass-strong mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src={kifaruLogo} alt="Kifaru" className="size-9 rounded-xl shadow-sm" />
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight">Kifaru</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                HR &amp; Payroll Intelligence
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl">
              <Link to="/dashboard">
                Open workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 sm:px-8 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 rounded-full glass-subtle px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            KIFARU-PF-FS-001 · v1 · Kenya-first
          </Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Your people, your payroll,
            <span className="block bg-gradient-to-r from-[oklch(0.45_0.1_230)] to-[oklch(0.55_0.09_185)] bg-clip-text text-transparent">
              one source of truth.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Kifaru is the multi-tenant HR and payroll intelligence platform for
            Kenyan organizations — managing the complete employee lifecycle and
            turning workforce data into decisions. Version 1: employee records
            your HR team can trust.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-2xl px-7 text-base shadow-lg">
              <Link to="/auth">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl px-7 text-base glass-subtle">
              <Link to="/dashboard">
                <Users className="size-4" />
                See headcount &amp; cost
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Lifecycle strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="glass mx-auto mt-14 max-w-5xl rounded-3xl p-5 sm:p-7"
        >
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            The complete employee lifecycle
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {lifecycle.map((stage, i) => (
              <span key={stage} className="flex items-center gap-1.5">
                <span className="rounded-full glass-subtle px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                  {stage}
                </span>
                {i < lifecycle.length - 1 && (
                  <span className="text-muted-foreground/50">·</span>
                )}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Principles / pillars */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass glass-hover rounded-3xl p-6 sm:p-7"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.14)] to-[oklch(0.6_0.09_190_/_0.14)] text-primary">
                <p.icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="glass grid gap-6 rounded-3xl p-8 sm:grid-cols-3 sm:p-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-primary">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Version 1 scope */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="glass-strong overflow-hidden rounded-3xl">
          <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge className="mb-4 rounded-full bg-primary/12 text-primary" variant="secondary">
                Version 1 scope
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Employee records and payroll, done right.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                One HR team. Canonical employee master data, departments,
                contracts and full change history — plus a Kenyan statutory
                payroll engine with versioned rules, validation gates, immutable
                locked periods and accounting journals.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Employee master records with canonical data",
                  "Headcount & monthly cost summary up front",
                  "Kenyan statutory payroll: PAYE, NSSF, SHIF, AHL",
                  "Immutable history for every consequential change",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <ShieldCheck className="size-3" />
                    </span>
                    <span className="text-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-8 h-12 rounded-2xl px-7">
                <Link to="/auth">
                  Enter the workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="glass-subtle flex flex-col justify-center gap-4 rounded-2xl p-6">
              {[
                { icon: Users, label: "Headcount", value: "Live, per department" },
                { icon: BarChart3, label: "Monthly cost", value: "KES gross payroll" },
                { icon: FileClock, label: "Change history", value: "Event log, effective-dated" },
                { icon: ShieldCheck, label: "Payroll", value: "PAYE · NSSF · SHIF · AHL" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 rounded-xl bg-white/55 p-3.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <row.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-8">
          <p>Kifaru — HR &amp; Payroll Intelligence · Nairobi, Kenya</p>
          <p>KIFARU-PF-FS-001 v1.0 · Baseline</p>
        </div>
      </footer>
    </div>
  );
}
