import { NextRequest, NextResponse } from "next/server";
import { insertEmployee, ensureHrTables } from "@/lib/hr/db";
import { ensureAdminTables } from "@/lib/admin/db";
import { sql as SQL } from "@/lib/sql-client";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const tenantSlug = formData.get("tenantSlug")?.toString() ?? "";

    if (!tenantSlug) {
      return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const text = new TextDecoder().decode(bytes);
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 });
    }

    await ensureAdminTables(SQL);
    await ensureHrTables(SQL);

    let imported = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    function inferRole(rawRole: string): { role: string; inferredFromTitle: boolean } {
      const lower = rawRole.toLowerCase();
      const exact: Record<string, string> = {
        staff: 'staff', employee: 'staff', worker: 'staff', member: 'staff',
        hod: 'hod', head: 'hod', 'head of department': 'hod',
        admin: 'admin', administrator: 'admin',
        executive: 'executive', exec: 'executive', ceo: 'executive', cto: 'executive', cfo: 'executive', coo: 'executive', cmo: 'executive',
      };
      if (exact[lower]) return { role: exact[lower], inferredFromTitle: false };
      if (lower.includes('director') || lower.includes('vp ') || lower.includes('vice president')) {
        return { role: 'executive', inferredFromTitle: true };
      }
      if (lower.includes('manager') || lower.includes('head ') || lower.includes(' lead') || lower.startsWith('lead ') || lower.includes('supervisor')) {
        return { role: 'hod', inferredFromTitle: true };
      }
      if (lower.includes('admin') || lower.includes('coordinator') || lower.includes('specialist') || lower.includes('analyst')) {
        return { role: 'admin', inferredFromTitle: true };
      }
      return { role: 'staff', inferredFromTitle: true };
    }

    const employmentTypeAliases: Record<string, string> = {
      'full-time': 'full-time', 'fulltime': 'full-time', 'full time': 'full-time', 'permanent': 'full-time',
      'part-time': 'part-time', 'parttime': 'part-time', 'part time': 'part-time',
      'contract': 'contract', 'contractor': 'contract', 'consultant': 'contract', 'freelance': 'contract',
      'intern': 'intern', 'internship': 'intern', 'trainee': 'intern',
    };

    const hodDepartments = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const firstName = (row.firstname || "").trim();
        const lastName = (row.lastname || "").trim();
        const email = (row.email || "").trim();
        const department = (row.department || "").trim();
        let position = (row.position || row.jobtitle || "").trim();
        const startDate = row.startdate || row.hiredate || null;
        const salaryRaw = (row.salary || "").trim();
        const salary = salaryRaw ? Number(salaryRaw.replace(/[^0-9.]/g, "")) : null;

        const rawRole = (row.role || "staff").trim();
        const { role: mappedRole, inferredFromTitle } = inferRole(rawRole);
        if (inferredFromTitle && !position) {
          position = rawRole;
        }

        const rawEmpType = (row.employmenttype || "full-time").trim().toLowerCase();
        const mappedEmpType = employmentTypeAliases[rawEmpType] || rawEmpType;

        if (!firstName || !lastName || !email) {
          errors.push(`Row ${i + 1}: missing required fields (firstname=${firstName}, lastname=${lastName}, email=${email})`);
          continue;
        }

        let finalRole = mappedRole;
        if (finalRole === 'hod' && department) {
          if (hodDepartments.has(department)) {
            finalRole = 'staff';
            warnings.push(`Row ${i + 1}: HOD already exists in "${department}". Assigned as staff instead.`);
          } else {
            const dupRows = await SQL`
              select id from admin_employees
              where tenant_slug = ${tenantSlug}
                and department_id = ${department}
                and role = 'hod'
              limit 1
            `;
            if ((dupRows as any[]).length > 0) {
              finalRole = 'staff';
              warnings.push(`Row ${i + 1}: HOD already exists in "${department}". Assigned as staff instead.`);
            } else {
              hodDepartments.add(department);
            }
          }
        }

        await insertEmployee({
          tenantSlug,
          name: `${firstName} ${lastName}`.trim(),
          email,
          departmentId: department,
          jobTitle: position,
          hireDate: startDate,
          salary,
          employmentType: mappedEmpType,
          role: finalRole,
          status: "active",
        });
        imported++;
      } catch (err: any) {
        const msg = err?.message || err?.toString?.() || "Unknown error";
        errors.push(`Row ${i + 1}: ${msg}`);
      }
    }

    return NextResponse.json({ imported, failed: errors.length, errors, warnings });
  } catch (error: any) {
    const errorDetail = error?.message || error?.toString?.() || "Unknown error";
    console.error("Employee import failed:", errorDetail, error);
    return NextResponse.json({ error: "Import failed", detail: errorDetail }, { status: 500 });
  }
}
