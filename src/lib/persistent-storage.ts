import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const DEPARTMENTS_FILE = path.join(DATA_DIR, "departments.json");

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating data directory:", error);
  }
}

// Employee storage
export async function getEmployees(): Promise<
  Record<string, Array<{ id: string; name: string; email: string; department: string; position: string; status: "active" | "inactive" }>>
> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(EMPLOYEES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty, return empty object
    return {};
  }
}

export async function saveEmployees(
  employees: Record<string, Array<{ id: string; name: string; email: string; department: string; position: string; status: "active" | "inactive" }>>
): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
  } catch (error) {
    console.error("Error saving employees:", error);
  }
}

export async function addEmployee(
  tenantSlug: string,
  employee: { id: string; name: string; email: string; department: string; position: string; status: "active" | "inactive" }
): Promise<void> {
  const employees = await getEmployees();
  if (!employees[tenantSlug]) {
    employees[tenantSlug] = [];
  }
  employees[tenantSlug].push(employee);
  await saveEmployees(employees);
}

// Department storage
export async function getDepartments(): Promise<
  Record<string, Array<{ id: string; name: string; manager: string; headcount: number }>>
> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(DEPARTMENTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty, return empty object
    return {};
  }
}

export async function saveDepartments(
  departments: Record<string, Array<{ id: string; name: string; manager: string; headcount: number }>>
): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(DEPARTMENTS_FILE, JSON.stringify(departments, null, 2));
  } catch (error) {
    console.error("Error saving departments:", error);
  }
}

export async function addDepartment(
  tenantSlug: string,
  department: { id: string; name: string; manager: string; headcount: number }
): Promise<void> {
  const departments = await getDepartments();
  if (!departments[tenantSlug]) {
    departments[tenantSlug] = [];
  }
  departments[tenantSlug].push(department);
  await saveDepartments(departments);
}

// Attendance storage
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");

// Timesheet storage
const TIMESHEET_FILE = path.join(DATA_DIR, "timesheet.json");

export async function getAttendanceRecords(): Promise<any[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(ATTENDANCE_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty, return empty array
    return [];
  }
}

export async function saveAttendanceRecords(records: any[]): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify(records, null, 2));
  } catch (error) {
    console.error("Error saving attendance records:", error);
  }
}

export async function addAttendanceRecord(record: any): Promise<void> {
  const records = await getAttendanceRecords();
  records.push(record);
  await saveAttendanceRecords(records);
}

export async function updateAttendanceRecord(recordId: string, updates: any): Promise<void> {
  const records = await getAttendanceRecords();
  const index = records.findIndex(r => r.id === recordId);
  if (index !== -1) {
    records[index] = { ...records[index], ...updates, updatedAt: new Date().toISOString() };
    await saveAttendanceRecords(records);
  }
}

// Timesheet storage functions
export async function getTimesheetEntries(): Promise<any[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(TIMESHEET_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty, return empty array
    return [];
  }
}

export async function saveTimesheetEntries(entries: any[]): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(TIMESHEET_FILE, JSON.stringify(entries, null, 2));
  } catch (error) {
    console.error("Error saving timesheet entries:", error);
  }
}

export async function addTimesheetEntry(entry: any): Promise<void> {
  const entries = await getTimesheetEntries();
  entries.push(entry);
  await saveTimesheetEntries(entries);
}

export async function getTimesheetEntriesForDate(tenantId: string, employeeId: string, workDate: string): Promise<any[]> {
  const entries = await getTimesheetEntries();
  return entries.filter(entry => 
    entry.tenantId === tenantId && 
    entry.employeeId === employeeId && 
    entry.workDate === workDate
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
