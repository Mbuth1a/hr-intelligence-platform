import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CopilotPanel } from "@/components/CopilotPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import kifaruLogo from "@/assets/kifaru-logo.svg";
import { useAuth } from "@/hooks/use-auth";
import { CalendarCheck, LogOut, Sparkles, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

function GlassBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 glass-canvas overflow-hidden">
      <div className="glass-blob left-[-8%] top-[-10%] h-96 w-96 bg-[oklch(0.85_0.07_220)]" />
      <div className="glass-blob right-[-6%] top-[8%] h-80 w-80 bg-[oklch(0.88_0.06_195)]" />
      <div className="glass-blob bottom-[-14%] left-[38%] h-[26rem] w-[26rem] bg-[oklch(0.88_0.05_255)]" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Employee view = linked to an employee record, or signed up with the
  // Employee role (self-service first). Everyone else defaults to the HR
  // overview (spec: sign-up role selection).
  const isEmployeeView =
    Boolean(user?.employeeId) || user?.appRole === "employee";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = (user?.name ?? user?.email ?? "HR")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <GlassBackground />

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="glass-strong mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-5">
          <Link to={isEmployeeView ? "/my" : "/dashboard"} className="flex items-center gap-2.5">
            <img
              src={kifaruLogo}
              alt="Kifaru"
              className="size-8 rounded-xl shadow-sm"
            />
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight">
                Kifaru
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                HR Intelligence
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5">
            {isEmployeeView && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-xl text-primary"
              >
                <Link to="/my">
                  <CalendarCheck className="size-4" />
                  My dashboard
                </Link>
              </Button>
            )}
            {!isEmployeeView && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <Link to="/dashboard">
                  <Users className="size-4" />
                  Overview
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Link to="/employees/dashboard">
                <Users className="size-4" />
                Employees
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Link to="/payroll">
                <Wallet className="size-4" />
                Payroll
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Link to="/my">
                <CalendarCheck className="size-4" />
                My workspace
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1.5 flex items-center gap-2 rounded-xl glass-subtle px-2 py-1.5 transition hover:bg-white/70">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary/15 text-[10px] font-bold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[10rem] truncate text-xs font-medium sm:block">
                    {user?.name || user?.email || "HR user"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="truncate">{user?.name || "HR user"}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user?.email || "—"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={isEmployeeView ? "/my" : "/dashboard"}>
                    {isEmployeeView ? "My dashboard" : "Company overview"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/employees">Employee records</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/payroll">Payroll</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/my">My workspace (self-service)</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleSignOut}
                  className="cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 pb-14 pt-6 sm:px-5">
        {children}
      </main>

      {/* Floating AI copilot trigger */}
      <button
        onClick={() => setCopilotOpen(true)}
        className="glass-strong fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-primary transition hover:scale-[1.03]"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">Ask Kifaru AI</span>
      </button>

      {copilotOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-3 sm:items-center sm:p-6">
          <button
            aria-label="Close copilot"
            className="absolute inset-0 bg-[oklch(0.3_0.03_245_/_0.18)] backdrop-blur-[2px]"
            onClick={() => setCopilotOpen(false)}
          />
          <div className="relative h-[80vh] max-h-[720px] w-full max-w-md">
            <CopilotPanel onClose={() => setCopilotOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
