import { NextRequest, NextResponse } from "next/server";
import { insertEmployee, ensureHrTables, resolveOrCreateDepartment } from "@/lib/hr/db";
import { ensureAdminTables } from "@/lib/admin/db";
import { sql as SQL } from "@/lib/sql-client";
import { setEmployeePassword } from "@/lib/hr/auth";

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

export const maxDuration = 120;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const tenantSlug = formData.get("tenantSlug")?.toString() ?? "";
    const defaultPassword = formData.get("defaultPassword")?.toString();

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
    const portalCredentials: Array<{ name: string; email: string; password: string }> = [];
    const { generatePassword } = await import("@/lib/hr/auth");

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

    // Pre-resolve all unique department names in batch to avoid repeated DB calls
    const uniqueDeptNames = new Set<string>();
    for (const row of rows) {
      const dept = (row.department || "").trim();
      if (dept) uniqueDeptNames.add(dept);
    }
    const deptMap = new Map<string, string>();
    for (const deptName of uniqueDeptNames) {
      try {
        const dept = await resolveOrCreateDepartment(tenantSlug, deptName);
        deptMap.set(deptName, dept.id);
      } catch {
        // Will be handled per-row as a warning
      }
    }

    // Pre-fetch all existing HODs for this tenant in one query
    const existingHods = await SQL`
      select department_id from admin_employees
      where tenant_slug = ${tenantSlug} and role = 'hod'
    `;
    for (const row of (existingHods as any[])) {
      if (row.department_id) hodDepartments.add(row.department_id);
    }

    // Process rows in concurrent batches for faster import
    const BATCH_SIZE = 5;
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);
      await Promise.all(batch.map(async (row, batchIdx) => {
        const i = batchStart + batchIdx;
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
            return;
          }

          // Use pre-resolved department or fall back to raw value
          let departmentId = department;
          if (department) {
            departmentId = deptMap.get(department) || department;
          }

          let finalRole = mappedRole;
          if (finalRole === 'hod' && departmentId) {
            if (hodDepartments.has(departmentId)) {
              finalRole = 'staff';
              warnings.push(`Row ${i + 1}: HOD already exists in "${department}". Assigned as staff instead.`);
            } else {
              hodDepartments.add(departmentId);
            }
          }

          const fullName = `${firstName} ${lastName}`.trim();
          const employee = await insertEmployee({
            tenantSlug,
            name: fullName,
            email,
            departmentId,
            jobTitle: position,
            hireDate: startDate,
            salary,
            employmentType: mappedEmpType,
            role: finalRole,
            status: "active",
          });
          imported++;

          // Always create portal account for imported employees
          const password = defaultPassword || generatePassword();
          await setEmployeePassword(tenantSlug, employee.id, password);
          portalCredentials.push({ name: fullName, email, password });
        } catch (err: any) {
          const msg = err?.message || err?.toString?.() || "Unknown error";
          errors.push(`Row ${i + 1}: ${msg}`);
        }
      }));
    }

    const response: any = { imported, failed: errors.length, errors, warnings };
    response.portalAccountsCreated = portalCredentials.length;
    response.portalCredentials = portalCredentials;
    return NextResponse.json(response);
  } catch (error: any) {
    const errorDetail = error?.message || error?.toString?.() || "Unknown error";
    console.error("Employee import failed:", errorDetail, error);
    return NextResponse.json({ error: "Import failed", detail: errorDetail }, { status: 500 });
  }
}
