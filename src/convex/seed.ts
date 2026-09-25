import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";

/** One-time demo seed for the single-tenant HR team (idempotent). */
export const seedIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const existingEmployees = await ctx.db.query("employees").collect();
    if (existingEmployees.length > 0) return { seeded: false as const };

    const existingDepartments = await ctx.db.query("departments").collect();
    if (existingDepartments.length > 0) return { seeded: false as const };

    type Dept = { name: string; code: string; monthlyBudget: number };
    const deptDefs: Dept[] = [
      { name: "Finance", code: "FIN", monthlyBudget: 1_800_000 },
      { name: "Human Resources", code: "HR", monthlyBudget: 900_000 },
      { name: "Technology", code: "TECH", monthlyBudget: 3_200_000 },
      { name: "Operations", code: "OPS", monthlyBudget: 1_500_000 },
      { name: "Sales", code: "SALES", monthlyBudget: 2_100_000 },
    ];
    const deptIds: Record<string, any> = {};
    for (const d of deptDefs) {
      deptIds[d.code] = await ctx.db.insert("departments", d);
    }

    type Emp = {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      jobTitle: string;
      dept: string;
      employmentType: "permanent" | "fixed-term" | "internship" | "contract";
      status: "active" | "probation" | "on_leave" | "offboarded";
      hireDate: string;
      exitDate?: string;
      monthlyGrossSalary: number;
      managerName?: string;
      location?: string;
    };

    const empDefs: Emp[] = [
      { firstName: "Peter", lastName: "Kamau", email: "peter.kamau@kifaru.co.ke", phone: "+254 711 000 001", jobTitle: "Finance Director", dept: "FIN", employmentType: "permanent", status: "active", hireDate: "2019-03-04", monthlyGrossSalary: 620000, location: "Nairobi HQ" },
      { firstName: "Grace", lastName: "Wanjiru", email: "grace.wanjiru@kifaru.co.ke", phone: "+254 711 000 002", jobTitle: "Senior Accountant", dept: "FIN", employmentType: "permanent", status: "active", hireDate: "2020-08-17", monthlyGrossSalary: 310000, managerName: "Peter Kamau", location: "Nairobi HQ" },
      { firstName: "Brian", lastName: "Otieno", email: "brian.otieno@kifaru.co.ke", phone: "+254 711 000 003", jobTitle: "Accounts Assistant", dept: "FIN", employmentType: "permanent", status: "active", hireDate: "2023-01-09", monthlyGrossSalary: 145000, managerName: "Grace Wanjiru", location: "Nairobi HQ" },
      { firstName: "Mary", lastName: "Achieng", email: "mary.achieng@kifaru.co.ke", phone: "+254 711 000 004", jobTitle: "HR Manager", dept: "HR", employmentType: "permanent", status: "active", hireDate: "2018-11-12", monthlyGrossSalary: 380000, location: "Nairobi HQ" },
      { firstName: "Dennis", lastName: "Mutua", email: "dennis.mutua@kifaru.co.ke", phone: "+254 711 000 005", jobTitle: "HR Assistant", dept: "HR", employmentType: "contract", status: "active", hireDate: "2024-06-03", monthlyGrossSalary: 95000, managerName: "Mary Achieng", location: "Nairobi HQ" },
      { firstName: "Samuel", lastName: "Kariuki", email: "samuel.kariuki@kifaru.co.ke", phone: "+254 711 000 006", jobTitle: "Engineering Lead", dept: "TECH", employmentType: "permanent", status: "active", hireDate: "2019-07-01", monthlyGrossSalary: 560000, location: "Nairobi HQ" },
      { firstName: "Faith", lastName: "Njeri", email: "faith.njeri@kifaru.co.ke", phone: "+254 711 000 007", jobTitle: "Senior Developer", dept: "TECH", employmentType: "permanent", status: "active", hireDate: "2021-02-15", monthlyGrossSalary: 420000, managerName: "Samuel Kariuki", location: "Nairobi HQ" },
      { firstName: "Kevin", lastName: "Mwangi", email: "kevin.mwangi@kifaru.co.ke", phone: "+254 711 000 008", jobTitle: "Developer", dept: "TECH", employmentType: "permanent", status: "active", hireDate: "2022-09-05", monthlyGrossSalary: 285000, managerName: "Faith Njeri", location: "Nairobi HQ" },
      { firstName: "Lucy", lastName: "Chebet", email: "lucy.chebet@kifaru.co.ke", phone: "+254 711 000 009", jobTitle: "Developer", dept: "TECH", employmentType: "permanent", status: "on_leave", hireDate: "2023-04-10", monthlyGrossSalary: 270000, managerName: "Faith Njeri", location: "Remote" },
      { firstName: "Alex", lastName: "Barasa", email: "alex.barasa@kifaru.co.ke", phone: "+254 711 000 010", jobTitle: "QA Engineer", dept: "TECH", employmentType: "contract", status: "active", hireDate: "2024-02-19", monthlyGrossSalary: 180000, managerName: "Samuel Kariuki", location: "Remote" },
      { firstName: "Janet", lastName: "Mwende", email: "janet.mwende@kifaru.co.ke", phone: "+254 711 000 011", jobTitle: "Engineering Intern", dept: "TECH", employmentType: "internship", status: "probation", hireDate: "2025-09-01", monthlyGrossSalary: 60000, managerName: "Samuel Kariuki", location: "Nairobi HQ" },
      { firstName: "Collins", lastName: "Omondi", email: "collins.omondi@kifaru.co.ke", phone: "+254 711 000 012", jobTitle: "Operations Manager", dept: "OPS", employmentType: "permanent", status: "active", hireDate: "2020-05-11", monthlyGrossSalary: 350000, location: "Mombasa Branch" },
      { firstName: "Nancy", lastName: "Wafula", email: "nancy.wafula@kifaru.co.ke", phone: "+254 711 000 013", jobTitle: "Logistics Coordinator", dept: "OPS", employmentType: "permanent", status: "active", hireDate: "2022-01-17", monthlyGrossSalary: 165000, managerName: "Collins Omondi", location: "Mombasa Branch" },
      { firstName: "Isaac", lastName: "Kiptoo", email: "isaac.kiptoo@kifaru.co.ke", phone: "+254 711 000 014", jobTitle: "Operations Associate", dept: "OPS", employmentType: "fixed-term", status: "active", hireDate: "2024-11-04", monthlyGrossSalary: 120000, managerName: "Collins Omondi", location: "Mombasa Branch" },
      { firstName: "Rose", lastName: "Naliaka", email: "rose.naliaka@kifaru.co.ke", phone: "+254 711 000 015", jobTitle: "Sales Director", dept: "SALES", employmentType: "permanent", status: "active", hireDate: "2019-09-23", monthlyGrossSalary: 480000, location: "Nairobi HQ" },
      { firstName: "Tom", lastName: "Odongo", email: "tom.odongo@kifaru.co.ke", phone: "+254 711 000 016", jobTitle: "Account Manager", dept: "SALES", employmentType: "permanent", status: "active", hireDate: "2021-06-14", monthlyGrossSalary: 250000, managerName: "Rose Naliaka", location: "Nairobi HQ" },
      { firstName: "Esther", lastName: "Nyambura", email: "esther.nyambura@kifaru.co.ke", phone: "+254 711 000 017", jobTitle: "Sales Executive", dept: "SALES", employmentType: "permanent", status: "active", hireDate: "2023-08-21", monthlyGrossSalary: 150000, managerName: "Tom Odongo", location: "Nairobi HQ" },
      { firstName: "Victor", lastName: "Kilonzo", email: "victor.kilonzo@kifaru.co.ke", phone: "+254 711 000 018", jobTitle: "Sales Executive", dept: "SALES", employmentType: "permanent", status: "probation", hireDate: "2025-06-02", monthlyGrossSalary: 140000, managerName: "Tom Odongo", location: "Nairobi HQ" },
      { firstName: "Alice", lastName: "Korir", email: "alice.korir@kifaru.co.ke", phone: "+254 711 000 019", jobTitle: "Payroll Officer", dept: "FIN", employmentType: "permanent", status: "active", hireDate: "2021-10-04", monthlyGrossSalary: 190000, managerName: "Peter Kamau", location: "Nairobi HQ" },
      { firstName: "George", lastName: "Ndegwa", email: "george.ndegwa@kifaru.co.ke", phone: "+254 711 000 020", jobTitle: "Driver", dept: "OPS", employmentType: "contract", status: "offboarded", hireDate: "2021-01-18", exitDate: "2025-03-28", monthlyGrossSalary: 70000, managerName: "Collins Omondi", location: "Mombasa Branch" },
    ];

    let num = 1;
    const empIdByCode: Record<string, any> = {};
    for (const e of empDefs) {
      empIdByCode[e.email] = await ctx.db.insert("employees", {
        employeeNumber: `KIF-${String(num++).padStart(4, "0")}`,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        jobTitle: e.jobTitle,
        departmentId: deptIds[e.dept],
        employmentType: e.employmentType,
        status: e.status,
        hireDate: e.hireDate,
        exitDate: e.exitDate,
        monthlyGrossSalary: e.monthlyGrossSalary,
        managerName: e.managerName,
        location: e.location,
      });
    }

    // A few historical events so the history timeline is alive from day one
    await ctx.db.insert("employeeEvents", {
      employeeId: empIdByCode["kevin.mwangi@kifaru.co.ke"],
      eventType: "promoted",
      effectiveDate: "2024-01-01",
      detail: "Role: Associate Developer → Developer",
      oldValue: "Associate Developer",
      newValue: "Developer",
      actorName: "Mary Achieng",
    });
    await ctx.db.insert("employeeEvents", {
      employeeId: empIdByCode["kevin.mwangi@kifaru.co.ke"],
      eventType: "salary_changed",
      effectiveDate: "2024-01-01",
      detail: "Salary changed",
      oldValue: "KES 230,000",
      newValue: "KES 285,000",
      actorName: "Peter Kamau",
    });
    await ctx.db.insert("employeeEvents", {
      employeeId: empIdByCode["nancy.wafula@kifaru.co.ke"],
      eventType: "transferred",
      effectiveDate: "2023-03-01",
      detail: "Department transfer",
      oldValue: "Sales",
      newValue: "Operations",
      actorName: "Mary Achieng",
    });
    await ctx.db.insert("employeeEvents", {
      employeeId: empIdByCode["george.ndegwa@kifaru.co.ke"],
      eventType: "offboarded",
      effectiveDate: "2025-03-28",
      detail: "Contract ended",
      oldValue: "active",
      newValue: "offboarded",
      actorName: "Mary Achieng",
    });

    return { seeded: true as const };
  },
});
