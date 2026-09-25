// KIFARU-PF-FS-001 — Payroll Rules Engine
// Statutory calculations are configurable, effective-dated, versioned and
// auditable (spec §41, BR-007). No rate is buried in application code: this
// module only interprets a StatutoryRulePackage that arrives with the run.

/** A versioned, effective-dated set of statutory rules for a jurisdiction. */
export type StatutoryRulePackage = {
  version: number;
  effectiveFrom: string; // ISO yyyy-mm-dd
  jurisdiction: string; // e.g. "KE"
  paye: {
    bands: { upTo: number | null; ratePct: number }[]; // monthly, KES
    personalRelief: number; // monthly KES
  };
  nssf: {
    tier1RatePct: number;
    tier1UpTo: number; // pensionable earnings ceiling tier 1
    tier2RatePct: number;
    tier2UpTo: number; // ceiling tier 2 (lower + upper earnings limit)
  };
  shif: { ratePct: number; minContribution: number };
  ahl: { ratePct: number; exemptionThreshold: number };
};

/** Current Kenya rules (Finance Act 2024/25 era). Effective-dated + versioned. */
export const KENYA_STATUTORY_RULES_V1: StatutoryRulePackage = {
  version: 1,
  effectiveFrom: "2025-01-01",
  jurisdiction: "KE",
  paye: {
    // Monthly PAYE bands (KES)
    bands: [
      { upTo: 24000, ratePct: 10 },
      { upTo: 32333, ratePct: 25 },
      { upTo: 500000, ratePct: 30 },
      { upTo: 800000, ratePct: 32.5 },
      { upTo: null, ratePct: 35 },
    ],
    personalRelief: 2400,
  },
  nssf: {
    tier1RatePct: 6,
    tier1UpTo: 8000,
    tier2RatePct: 6,
    tier2UpTo: 72000,
  },
  shif: { ratePct: 2.75, minContribution: 300 },
  ahl: { ratePct: 1.5, exemptionThreshold: 500 },
};

export type PayrollInputTrace = {
  source:
    | "compensation"
    | "leave"
    | "attendance"
    | "benefits"
    | "loans"
    | "statutory";
  note: string;
};

export type PayslipLine = {
  code: string;
  label: string;
  amount: number;
  type: "earning" | "deduction";
  source: string; // traceability (BR-008)
};

export type EmployeePayrollCalc = {
  employeeId: string;
  employeeNumber: string;
  name: string;
  department: string;
  jobTitle: string;
  employmentType: string;
  status: string;
  grossPay: number;
  taxablePay: number;
  paye: number;
  nssfEmployee: number;
  shif: number;
  ahl: number;
  totalDeductions: number;
  netPay: number;
  employerNssf: number;
  employerShif: number;
  employerAhl: number;
  employerCost: number;
  lines: PayslipLine[];
  inputs: PayrollInputTrace[];
  warnings: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Progressive tax on annual-equivalent monthly taxable pay, then relief. */
export function calcPAYE(
  taxablePayMonthly: number,
  paye: StatutoryRulePackage["paye"],
): number {
  // Bands are monthly; apply progressively.
  let remaining = Math.max(0, taxablePayMonthly);
  let lower = 0;
  let tax = 0;
  for (const band of paye.bands) {
    const upper = band.upTo ?? Infinity;
    const span = Math.min(remaining, upper - lower);
    if (span <= 0) break;
    tax += (span * band.ratePct) / 100;
    remaining -= span;
    lower = upper;
  }
  return round2(Math.max(0, tax - paye.personalRelief));
}

export function calcNSSF(
  gross: number,
  nssf: StatutoryRulePackage["nssf"],
): { employee: number; employer: number } {
  const tier1 = Math.min(gross, nssf.tier1UpTo);
  const tier2 = Math.min(Math.max(0, gross - nssf.tier1UpTo), nssf.tier2UpTo - nssf.tier1UpTo);
  const employee = round2((tier1 * nssf.tier1RatePct) / 100 + (tier2 * nssf.tier2RatePct) / 100);
  return { employee, employer: employee }; // matched contribution
}

export function calcSHIF(
  gross: number,
  shif: StatutoryRulePackage["shif"],
): number {
  return round2(Math.max(shif.minContribution, (gross * shif.ratePct) / 100));
}

export function calcAHL(
  gross: number,
  ahl: StatutoryRulePackage["ahl"],
): number {
  if (gross <= ahl.exemptionThreshold) return 0;
  return round2((gross * ahl.ratePct) / 100);
}

/** NOTE: NSSF employee contribution is an allowable deduction for PAYE. */
export function calcEmployeePayroll(
  emp: {
    _id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    employmentType: string;
    status: string;
    monthlyGrossSalary: number;
    departmentName: string;
  },
  rules: StatutoryRulePackage,
): EmployeePayrollCalc {
  const gross = emp.monthlyGrossSalary;
  const nssf = calcNSSF(gross, rules.nssf);
  const shif = calcSHIF(gross, rules.shif);
  const ahl = calcAHL(gross, rules.ahl);
  const taxablePay = Math.max(0, gross - nssf.employee);
  const paye = calcPAYE(taxablePay, rules.paye);

  const lines: PayslipLine[] = [
    {
      code: "BASIC",
      label: "Basic salary",
      amount: gross,
      type: "earning",
      source: "compensation: monthlyGrossSalary",
    },
    {
      code: "NSSF",
      label: "NSSF (Tier I+II)",
      amount: -nssf.employee,
      type: "deduction",
      source: `statutory rules v${rules.version} (KE)`,
    },
    {
      code: "SHIF",
      label: "SHIF (health insurance)",
      amount: -shif,
      type: "deduction",
      source: `statutory rules v${rules.version} (KE)`,
    },
    {
      code: "AHL",
      label: "Affordable Housing Levy",
      amount: -ahl,
      type: "deduction",
      source: `statutory rules v${rules.version} (KE)`,
    },
    {
      code: "PAYE",
      label: "PAYE (income tax)",
      amount: -paye,
      type: "deduction",
      source: `statutory rules v${rules.version} (KE)`,
    },
  ];

  const totalDeductions = round2(nssf.employee + shif + ahl + paye);
  const netPay = round2(gross - totalDeductions);
  const employerShif = shif; // SHIF is matched 1:1 by employer
  const employerCost = round2(gross + nssf.employer + employerShif + ahl);

  const warnings: string[] = [];
  if (netPay < 0) warnings.push("Negative net pay");
  if (emp.status === "probation") warnings.push("Employee on probation");

  return {
    employeeId: emp._id,
    employeeNumber: emp.employeeNumber,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.departmentName,
    jobTitle: emp.jobTitle,
    employmentType: emp.employmentType,
    status: emp.status,
    grossPay: round2(gross),
    taxablePay: round2(taxablePay),
    paye,
    nssfEmployee: nssf.employee,
    shif,
    ahl,
    totalDeductions,
    netPay,
    employerNssf: nssf.employer,
    employerShif,
    employerAhl: ahl,
    employerCost,
    lines,
    inputs: [
      { source: "compensation", note: `Basic salary ${gross}` },
      { source: "statutory", note: `KE statutory rules v${rules.version} eff. ${rules.effectiveFrom}` },
    ],
    warnings,
  };
}
