import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
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
import { formatKES } from "@/lib/format";
import { Building2, Loader2, Pencil, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Department = Doc<"departments"> & {
  headcount: number;
  monthlyCost: number;
};

export function DepartmentsPanel() {
  const departments = useQuery(api.departments.list, {}) as
    | Department[]
    | undefined;
  const create = useMutation(api.departments.create);
  const update = useMutation(api.departments.update);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setBudget("");
    setDialogOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setCode(d.code);
    setBudget(d.monthlyBudget ? String(d.monthlyBudget) : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const budgetNum = budget ? Number(budget) : undefined;
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required.");
      return;
    }
    if (budgetNum !== undefined && (isNaN(budgetNum) || budgetNum < 0)) {
      toast.error("Budget must be a positive number.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update({
          id: editing._id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          monthlyBudget: budgetNum,
        });
        toast.success("Department updated.");
      } else {
        await create({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          monthlyBudget: budgetNum,
        });
        toast.success("Department created.");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (departments === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCost = departments.reduce((s, d) => s + d.monthlyCost, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Departments</h3>
          <p className="text-sm text-muted-foreground">
            Organizational units with live headcount and budget utilisation.
          </p>
        </div>
        <Button className="rounded-xl" onClick={openCreate}>
          <Plus className="size-4" />
          New department
        </Button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => {
          const util =
            d.monthlyBudget && d.monthlyBudget > 0
              ? d.monthlyCost / d.monthlyBudget
              : null;
          const overBudget = util !== null && util > 1;
          return (
            <Card key={d._id} className="glass-hover">
              <CardContent className="px-5 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.16)] to-[oklch(0.6_0.09_190_/_0.16)] text-primary">
                      <Building2 className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.code} · {d.headcount}{" "}
                        {d.headcount === 1 ? "person" : "people"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly cost</span>
                    <span className="font-semibold tabular-nums">
                      {formatKES(d.monthlyCost, { compact: true })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg salary</span>
                    <span className="font-medium tabular-nums">
                      {d.headcount
                        ? formatKES(d.monthlyCost / d.headcount, { compact: true })
                        : "—"}
                    </span>
                  </div>
                  {d.monthlyBudget != null && (
                    <div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Budget</span>
                        <span
                          className={`font-medium tabular-nums ${
                            overBudget ? "text-destructive" : ""
                          }`}
                        >
                          {formatKES(d.monthlyBudget, { compact: true })} ·{" "}
                          {Math.round((util ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                        <div
                          className={`h-full rounded-full ${
                            overBudget
                              ? "bg-destructive"
                              : "bg-gradient-to-r from-[oklch(0.48_0.09_230)] to-[oklch(0.62_0.09_195)]"
                          }`}
                          style={{
                            width: `${Math.min(Math.max((util ?? 0) * 100, 2), 100)}%`,
                          }}
                        />
                      </div>
                      {overBudget && (
                        <p className="mt-1 text-xs text-destructive">
                          Over budget by{" "}
                          {formatKES(d.monthlyCost - d.monthlyBudget, { compact: true })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="glass-subtle border-dashed">
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <Users className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">{departments.length} departments</p>
            <p className="text-xs text-muted-foreground">
              Total cost {formatKES(totalCost, { compact: true })} / month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-strong sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit department" : "New department"}</DialogTitle>
            <DialogDescription>
              Departments are the organizational units employees belong to.
              {editing && " Headcount and cost update live from employee records."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="deptName">Name</Label>
              <Input
                id="deptName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer Success"
                className="glass-subtle"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deptCode">Code</Label>
              <Input
                id="deptCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CS"
                maxLength={6}
                className="glass-subtle font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deptBudget">Monthly budget (KES, optional)</Label>
              <Input
                id="deptBudget"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 1500000"
                className="glass-subtle"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="glass-subtle"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
