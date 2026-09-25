import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useSeedOnce } from "@/hooks/use-seed-once";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, EVENT_TYPE_LABELS, formatDate, formatKES } from "@/lib/format";
import { useEffect } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router";

type Employee = Doc<"employees">;
type Department = Doc<"departments">;

const statusTone: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  probation: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  on_leave: "bg-sky-500/15 text-sky-700 border-sky-500/25",
  offboarded: "bg-slate-500/12 text-slate-600 border-slate-400/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`rounded-full border ${statusTone[status] ?? "bg-white/60"}`}>
      {EMPLOYEE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Employee form dialog (add / edit)
// ---------------------------------------------------------------------------

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  departmentId: string;
  employmentType: string;
  status: string;
  hireDate: string;
  monthlyGrossSalary: string;
  managerName: string;
  location: string;
};

function formFromEmployee(e: Employee | null, departments: Department[]): FormState {
  if (!e) {
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      jobTitle: "",
      departmentId: departments[0]?._id ?? "",
      employmentType: "permanent",
      status: "active",
      hireDate: new Date().toISOString().slice(0, 10),
      monthlyGrossSalary: "",
      managerName: "",
      location: "Nairobi HQ",
    };
  }
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone ?? "",
    jobTitle: e.jobTitle,
    departmentId: e.departmentId,
    employmentType: e.employmentType,
    status: e.status,
    hireDate: e.hireDate,
    monthlyGrossSalary: String(e.monthlyGrossSalary),
    managerName: e.managerName ?? "",
    location: e.location ?? "",
  };
}

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  departments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee: Employee | null;
  departments: Department[];
  onSaved: (id: Id<"employees">) => void;
}) {
  const { user } = useAuth();
  const create = useMutation(api.employees.create);
  const update = useMutation(api.employees.update);
  const [form, setForm] = useState<FormState>(() => formFromEmployee(employee, departments));
  const [saving, setSaving] = useState(false);

  // Re-seed the form every time the dialog opens
  useEffect(() => {
    if (open) {
      setForm(formFromEmployee(employee, departments));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.departmentId) {
      toast.error("Please choose a department.");
      return;
    }
    const salary = Number(form.monthlyGrossSalary);
    if (!salary || salary <= 0) {
      toast.error("Please enter a valid monthly gross salary.");
      return;
    }
    setSaving(true);
    try {
      const actorName = user?.name || user?.email || "HR team";
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim(),
        departmentId: form.departmentId as Id<"departments">,
        employmentType: form.employmentType,
        status: form.status,
        monthlyGrossSalary: salary,
        managerName: form.managerName.trim() || undefined,
        location: form.location.trim() || undefined,
        actorName,
      };
      if (employee) {
        await update({ id: employee._id, ...payload });
        toast.success(`${form.firstName} ${form.lastName} updated. Changes recorded in history.`);
      } else {
        const id = await create({ ...payload, hireDate: form.hireDate });
        toast.success(`${form.firstName} ${form.lastName} added to records.`);
        onSaved(id);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {employee
              ? "Consequential changes (salary, role, department, manager, status) are recorded as history events."
              : "Create a canonical employee record. A unique employee number is generated automatically."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+254 …" className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} required className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)} required>
                <SelectTrigger className="glass-subtle w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)}>
                <SelectTrigger className="glass-subtle w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="glass-subtle w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!employee && (
              <div className="space-y-1.5">
                <Label htmlFor="hireDate">Hire date</Label>
                <Input id="hireDate" type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} required className="glass-subtle" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="salary">Monthly gross salary (KES)</Label>
              <Input id="salary" type="number" min={0} value={form.monthlyGrossSalary} onChange={(e) => set("monthlyGrossSalary", e.target.value)} required className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="managerName">Reports to</Label>
              <Input id="managerName" value={form.managerName} onChange={(e) => set("managerName", e.target.value)} placeholder="Manager name" className="glass-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Work location</Label>
              <Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} className="glass-subtle" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="glass-subtle" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {employee ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet (record + history timeline) & offboard dialog
// ---------------------------------------------------------------------------

function OffboardDialog({
  employee,
  open,
  onOpenChange,
  onDone,
}: {
  employee: Employee;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const offboard = useMutation(api.employees.offboard);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    setSaving(true);
    try {
      await offboard({
        id: employee._id,
        effectiveDate: date,
        reason: reason.trim() || "Employment ended",
        actorName: user?.name || user?.email || "HR team",
      });
      toast.success(`${employee.firstName} ${employee.lastName} offboarded. Record retained.`);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Offboard {employee.firstName} {employee.lastName}</DialogTitle>
          <DialogDescription>
            The record is never deleted — status becomes “offboarded” and the exit is recorded in history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exitDate">Effective date</Label>
            <Input id="exitDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="glass-subtle" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Resignation, contract ended, redundancy…" className="glass-subtle" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="glass-subtle" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handle} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Confirm offboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const eventTone: Record<string, string> = {
  hired: "bg-emerald-500",
  promoted: "bg-violet-500",
  salary_changed: "bg-sky-500",
  transferred: "bg-teal-500",
  manager_changed: "bg-amber-500",
  status_changed: "bg-slate-400",
  employee_updated: "bg-slate-300",
  offboarded: "bg-rose-500",
};

function EmployeeDetailSheet({
  employeeId,
  open,
  onOpenChange,
  departments,
  onEdit,
}: {
  employeeId: Id<"employees"> | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  departments: Department[];
  onEdit: (e: Employee) => void;
}) {
  const detail = useQuery(
    api.employees.get,
    employeeId && open ? { id: employeeId } : "skip",
  );
  const [offboardOpen, setOffboardOpen] = useState(false);

  const employee = detail?.employee;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass-strong w-full overflow-y-auto sm:max-w-lg sm:w-[32rem]">
        {detail === undefined ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !employee ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Employee not found.
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <SheetHeader className="pb-0">
              <div className="flex items-start gap-3">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.18)] to-[oklch(0.6_0.09_190_/_0.18)] text-lg font-bold text-primary">
                  {employee.firstName[0]}{employee.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">
                    {employee.firstName} {employee.lastName}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {employee.employeeNumber} · {employee.jobTitle}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge status={employee.status} />
                    <Badge variant="outline" className="rounded-full bg-white/55">
                      {EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-5 flex-1 space-y-5 overflow-y-auto px-1 pb-6">
              <div className="glass-subtle rounded-2xl p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Employment</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Department</dt>
                    <dd className="font-medium">{detail.department?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Hired</dt>
                    <dd className="font-medium">{formatDate(employee.hireDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Monthly salary</dt>
                    <dd className="font-medium tabular-nums">{formatKES(employee.monthlyGrossSalary)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Reports to</dt>
                    <dd className="font-medium">{employee.managerName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Location</dt>
                    <dd className="font-medium">{employee.location ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Contact</dt>
                    <dd className="truncate font-medium">{employee.email}</dd>
                  </div>
                  {employee.exitDate && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Exit date</dt>
                      <dd className="font-medium">{formatDate(employee.exitDate)}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">History</p>
                  <Badge variant="secondary" className="rounded-full bg-white/55 text-[10px]">
                    <ShieldCheck className="size-3" />
                    immutable log
                  </Badge>
                </div>
                {detail.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                ) : (
                  <ol className="relative space-y-4 border-l border-white/70 pl-5">
                    {detail.events.map((ev) => (
                      <li key={ev._id} className="relative">
                        <span className={`absolute -left-[1.55rem] top-1 size-2.5 rounded-full ${eventTone[ev.eventType] ?? "bg-slate-300"} ring-4 ring-white/60`} />
                        <div className="glass-subtle rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}</p>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <CalendarDays className="size-3" />
                              {formatDate(ev.effectiveDate)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{ev.detail}</p>
                          {(ev.oldValue || ev.newValue) && (
                            <p className="mt-1.5 text-xs">
                              {ev.oldValue && <span className="rounded bg-white/60 px-1.5 py-0.5 line-through text-muted-foreground">{ev.oldValue}</span>}
                              {ev.oldValue && ev.newValue && <span className="mx-1 text-muted-foreground">→</span>}
                              {ev.newValue && <span className="rounded bg-emerald-500/12 px-1.5 py-0.5 font-medium text-emerald-700">{ev.newValue}</span>}
                            </p>
                          )}
                          {ev.actorName && (
                            <p className="mt-1.5 text-[11px] text-muted-foreground">by {ev.actorName}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {employee.status !== "offboarded" && (
              <div className="flex gap-2 border-t border-white/60 pt-4">
                <Button
                  variant="outline"
                  className="glass-subtle flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(employee);
                  }}
                >
                  Edit record
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setOffboardOpen(true)}
                >
                  <UserMinus className="size-4" />
                  Offboard
                </Button>
              </div>
            )}
          </div>
        )}

        {employee && (
          <OffboardDialog
            employee={employee}
            open={offboardOpen}
            onOpenChange={setOffboardOpen}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Employees() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<Id<"employees"> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const employees = useQuery(api.employees.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    departmentId:
      deptFilter === "all" ? undefined : (deptFilter as Id<"departments">),
    search: search || undefined,
  });
  const departments = useQuery(api.departments.list, {});
  useSeedOnce();

  if (employees === undefined || departments === undefined) {
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Employee master records</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Canonical employee data — one source of truth for the organization.
          </p>
        </div>
        <Button
          className="rounded-xl"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add employee
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, number, title or email…"
            className="glass-subtle rounded-xl pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="glass-subtle w-full rounded-xl sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter} disabled={departments.length === 0}>
          <SelectTrigger className="glass-subtle w-full rounded-xl sm:w-52">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d._id} value={d._id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="mt-4 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Monthly salary</TableHead>
                <TableHead>Hired</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center text-sm text-muted-foreground">
                    No employees match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((e) => (
                  <TableRow
                    key={e._id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(e._id)}
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.18)] to-[oklch(0.6_0.09_190_/_0.18)] text-xs font-bold text-primary">
                          {e.firstName[0]}
                          {e.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {e.firstName} {e.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {e.employeeNumber} · {e.jobTitle}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {departments.find((d) => d._id === e.departmentId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatKES(e.monthlyGrossSalary)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(e.hireDate)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-lg"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setDetailId(e._id);
                        }}
                      >
                        View
                        <ArrowUpRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        {employees.length} record{employees.length === 1 ? "" : "s"} · salary, role, department and manager changes are recorded in the employee&apos;s immutable history.
      </p>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        departments={departments}
        onSaved={(id) => setDetailId(id)}
      />

      <EmployeeDetailSheet
        employeeId={detailId}
        open={detailId !== null}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        departments={departments}
        onEdit={(e) => {
          setEditing(e);
          setFormOpen(true);
        }}
      />
    </AppShell>
  );
}
