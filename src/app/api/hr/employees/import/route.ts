import { NextRequest, NextResponse } from "next/server";
import { insertEmployee, ensureHrTables } from "@/lib/hr/db";
import { sql as SQL } from "@/lib/sql-client";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
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

    await ensureHrTables(SQL);

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const firstName = row.firstname || row["first name"] || "";
        const lastName = row.lastname || row["last name"] || "";
        const email = row.email || "";
        const department = row.department || "";
        const position = row.position || row.jobtitle || row["job title"] || "";
        const startDate = row.startdate || row["start date"] || row.hiredate || null;
        const salaryRaw = row.salary || "";
        const salary = salaryRaw ? Number(salaryRaw.replace(/[^0-9.]/g, "")) : null;
        const employmentType = row.employmenttype || row["employment type"] || "full-time";
        const role = (row.role || "staff").toLowerCase();

        if (!firstName || !lastName || !email) {
          errors.push(`Row ${i + 1}: missing required fields`);
          continue;
        }

        await insertEmployee({
          tenantSlug,
          name: `${firstName} ${lastName}`.trim(),
          email,
          departmentId: department,
          jobTitle: position,
          hireDate: startDate,
          salary,
          employmentType: employmentType.toLowerCase(),
          role,
          status: "active",
        });
        imported++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message || "Unknown error"}`);
      }
    }

    return NextResponse.json({ imported, failed: errors.length, errors });
  } catch (error: any) {
    console.error("Employee import failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
