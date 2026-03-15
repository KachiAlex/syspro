/**
 * Tenant Admin Service Layer
 * Comprehensive business logic for all tenant-admin features
 */

import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { randomUUID } from "node:crypto";
import type {
  Department,
  DepartmentCreateRequest,
  DepartmentUpdateRequest,
  Role,
  RoleCreateRequest,
  RoleUpdateRequest,
  Employee,
  EmployeeCreateRequest,
  EmployeeUpdateRequest,
  AccessAccount,
  ApprovalFlow,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalAction,
  Workflow,
  Module,
  FeatureFlag,
  Integration,
  APIKey,
  AuditLog,
  AuditAction,
  TenantSlug,
  ResourceId,
  UserId,
} from "./types";

/**
 * Department Service
 */
export class DepartmentService {
  constructor(private sql: SqlClient = SQL) {}

  async create(tenantSlug: TenantSlug, req: DepartmentCreateRequest): Promise<Department> {
    const id = randomUUID() as ResourceId;
    const now = new Date();

    await this.sql`
      insert into admin_departments (id, tenant_slug, name, description, parent_department_id, cost_center, manager_id, created_at, updated_at)
      values (${id}, ${tenantSlug}, ${req.name}, ${req.description || null}, ${req.parentDepartmentId || null}, ${req.costCenter || null}, ${req.manager || null}, ${now}, ${now})
    `;

    return this.getById(tenantSlug, id as ResourceId) as Promise<Department>;
  }

  async getAll(tenantSlug: TenantSlug): Promise<Department[]> {
    return this.sql`
      select * from admin_departments
      where tenant_slug = ${tenantSlug}
      order by name asc
    `;
  }

  async getById(tenantSlug: TenantSlug, id: ResourceId): Promise<Department | null> {
    const results = await this.sql`
      select * from admin_departments
      where id = ${id} and tenant_slug = ${tenantSlug}
    `;
    return results[0] || null;
  }

  async update(tenantSlug: TenantSlug, id: ResourceId, req: DepartmentUpdateRequest): Promise<Department> {
    const updates: Record<string, any> = { ...req, updated_at: new Date() };
    
    const setClauses = Object.entries(updates)
      .map(([k, v]) => `${k} = $${k}`)
      .join(", ");

    await this.sql.query(
      `update admin_departments set ${setClauses} where id = $id and tenant_slug = $tenantSlug`,
      { id, tenantSlug, ...updates }
    );

    return this.getById(tenantSlug, id) as Promise<Department>;
  }

  async delete(tenantSlug: TenantSlug, id: ResourceId): Promise<void> {
    await this.sql`delete from admin_departments where id = ${id} and tenant_slug = ${tenantSlug}`;
  }

  async getHierarchy(tenantSlug: TenantSlug): Promise<Department[]> {
    // Returns departments in hierarchical order
    return this.sql`
      with recursive dept_tree as (
        select * from admin_departments
        where tenant_slug = ${tenantSlug} and parent_department_id is null
        union all
        select d.* from admin_departments d
        join dept_tree dt on d.parent_department_id = dt.id
      )
      select * from dept_tree order by parent_department_id nulls first, name
    `;
  }
}

/**
 * Role Builder Service
 */
export class RoleService {
  constructor(private sql: SqlClient = SQL) {}

  async create(tenantSlug: TenantSlug, req: RoleCreateRequest): Promise<Role> {
    const id = randomUUID() as ResourceId;
    const now = new Date();

    await this.sql`
      insert into admin_roles (id, tenant_slug, name, scope, permissions, description, created_at, updated_at)
      values (${id}, ${tenantSlug}, ${req.name}, ${req.scope}, ${JSON.stringify(req.permissions)}, ${req.description || null}, ${now}, ${now})
    `;

    return this.getById(tenantSlug, id as ResourceId) as Promise<Role>;
  }

  async getAll(tenantSlug: TenantSlug): Promise<Role[]> {
    return this.sql`select * from admin_roles where tenant_slug = ${tenantSlug} order by name asc`;
  }

  async getById(tenantSlug: TenantSlug, id: ResourceId): Promise<Role | null> {
    const results = await this.sql`select * from admin_roles where id = ${id} and tenant_slug = ${tenantSlug}`;
    return results[0] || null;
  }

  async update(tenantSlug: TenantSlug, id: ResourceId, req: RoleUpdateRequest): Promise<Role> {
    const updates: any = { ...req, updated_at: new Date() };
    if (req.permissions) {
      updates.permissions = JSON.stringify(req.permissions);
    }

    const setClauses = Object.entries(updates)
      .map(([k]) => `${k} = $${k}`)
      .join(", ");

    await this.sql.query(
      `update admin_roles set ${setClauses} where id = $id and tenant_slug = $tenantSlug`,
      { id, tenantSlug, ...updates }
    );

    return this.getById(tenantSlug, id) as Promise<Role>;
  }

  async delete(tenantSlug: TenantSlug, id: ResourceId): Promise<void> {
    await this.sql`delete from admin_roles where id = ${id} and tenant_slug = ${tenantSlug}`;
  }

  async assignToUser(tenantSlug: TenantSlug, userId: UserId, roleId: ResourceId, scope: string = "tenant"): Promise<void> {
    await this.sql`
      insert into admin_user_roles (id, tenant_slug, user_id, role_id, scope, created_at)
      values (${randomUUID()}, ${tenantSlug}, ${userId}, ${roleId}, ${scope}, ${new Date()})
      on conflict (user_id, role_id) do update set scope = ${scope}
    `;
  }
}

/**
 * Employee Service
 */
export class EmployeeService {
  constructor(private sql: SqlClient = SQL) {}

  async create(tenantSlug: TenantSlug, req: EmployeeCreateRequest): Promise<Employee> {
    const id = randomUUID() as ResourceId;
    const now = new Date();

    await this.sql`
      insert into admin_employees (id, tenant_slug, name, email, department_id, reporting_manager_id, phone, job_title, hire_date, status, created_at, updated_at)
      values (${id}, ${tenantSlug}, ${req.name}, ${req.email}, ${req.departmentId}, ${req.reportingManagerId || null}, ${req.phone || null}, ${req.jobTitle || null}, ${req.hireDate || null}, 'active', ${now}, ${now})
    `;

    return this.getById(tenantSlug, id as ResourceId) as Promise<Employee>;
  }

  async getAll(tenantSlug: TenantSlug, departmentId?: ResourceId): Promise<Employee[]> {
    const query = departmentId
      ? `select * from admin_employees where tenant_slug = $1 and department_id = $2 order by name`
      : `select * from admin_employees where tenant_slug = $1 order by name`;
    
    return this.sql.query(query, departmentId ? [tenantSlug, departmentId] : [tenantSlug]);
  }

  async getById(tenantSlug: TenantSlug, id: ResourceId): Promise<Employee | null> {
    const results = await this.sql`select * from admin_employees where id = ${id} and tenant_slug = ${tenantSlug}`;
    return results[0] || null;
  }

  async update(tenantSlug: TenantSlug, id: ResourceId, req: EmployeeUpdateRequest): Promise<Employee> {
    const updates = { ...req, updated_at: new Date() };
    
    const setClauses = Object.entries(updates)
      .map(([k]) => `${k} = $${k}`)
      .join(", ");

    await this.sql.query(
      `update admin_employees set ${setClauses} where id = $id and tenant_slug = $tenantSlug`,
      { id, tenantSlug, ...updates }
    );

    return this.getById(tenantSlug, id) as Promise<Employee>;
  }

  async delete(tenantSlug: TenantSlug, id: ResourceId): Promise<void> {
    await this.sql`delete from admin_employees where id = ${id} and tenant_slug = ${tenantSlug}`;
  }

  async getTeam(tenantSlug: TenantSlug, managerId: UserId): Promise<Employee[]> {
    return this.sql`
      select * from admin_employees
      where tenant_slug = ${tenantSlug} and reporting_manager_id = ${managerId}
      order by name
    `;
  }
}

/**
 * Access Control Service
 */
export class AccessControlService {
  constructor(private sql: SqlClient = SQL) {}

  async getForRole(tenantSlug: TenantSlug, roleId: ResourceId): Promise<AccessAccount | null> {
    const results = await this.sql`
      select * from admin_access_controls
      where tenant_slug = ${tenantSlug} and role_id = ${roleId}
    `;
    return results[0] || null;
  }

  async updateModuleAccess(tenantSlug: TenantSlug, roleId: ResourceId, moduleAccess: any[]): Promise<void> {
    await this.sql`
      update admin_access_controls
      set module_access = ${JSON.stringify(moduleAccess)}, updated_at = ${new Date()}
      where tenant_slug = ${tenantSlug} and role_id = ${roleId}
    `;
  }

  async grantTemporaryAccess(
    tenantSlug: TenantSlug,
    grantedTo: UserId,
    moduleKey: string,
    permissions: string[],
    expiresAt: Date,
    justification: string,
    approvedBy: UserId
  ): Promise<void> {
    const id = randomUUID();
    await this.sql`
      insert into admin_temporary_access (id, tenant_slug, granted_to, module_key, permissions, expires_at, justification, approved_by, created_at)
      values (${id}, ${tenantSlug}, ${grantedTo}, ${moduleKey}, ${JSON.stringify(permissions)}, ${expiresAt}, ${justification}, ${approvedBy}, ${new Date()})
    `;
  }

  async revokeTemporaryAccess(tenantSlug: TenantSlug, accessId: string): Promise<void> {
    await this.sql`
      delete from admin_temporary_access
      where id = ${accessId} and tenant_slug = ${tenantSlug}
    `;
  }

  async getActiveTemporaryAccess(tenantSlug: TenantSlug, userId: UserId): Promise<any[]> {
    return this.sql`
      select * from admin_temporary_access
      where tenant_slug = ${tenantSlug} and granted_to = ${userId} and expires_at > now()
      order by expires_at asc
    `;
  }
}

/**
 * Approval Flow Service
 */
export class ApprovalFlowService {
  constructor(private sql: SqlClient = SQL) {}

  async createFlow(tenantSlug: TenantSlug, flowName: string, flowType: string, steps: any[]): Promise<ResourceId> {
    const id = randomUUID() as ResourceId;
    const now = new Date();

    await this.sql`
      insert into admin_approval_flows (id, tenant_slug, name, type, steps, is_active, created_at, updated_at)
      values (${id}, ${tenantSlug}, ${flowName}, ${flowType}, ${JSON.stringify(steps)}, true, ${now}, ${now})
    `;

    return id;
  }

  async createRequest(
    tenantSlug: TenantSlug,
    flowId: ResourceId,
    flowType: string,
    requesterId: UserId,
    subjectId: ResourceId
  ): Promise<ApprovalRequest> {
    const id = randomUUID() as ResourceId;
    const now = new Date();

    await this.sql`
      insert into admin_approval_requests (id, tenant_slug, flow_id, flow_type, requester_id, subject_id, status, current_step_index, history, created_at, updated_at)
      values (${id}, ${tenantSlug}, ${flowId}, ${flowType}, ${requesterId}, ${subjectId}, 'pending', 0, '[]', ${now}, ${now})
    `;

    return {
      id,
      tenantSlug,
      flowId,
      flowType,
      requesterId,
      subjectId,
      status: "pending" as ApprovalStatus,
      currentStepIndex: 0,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async approveRequest(
    tenantSlug: TenantSlug,
    requestId: ResourceId,
    approvalAction: ApprovalAction,
    actionBy: UserId,
    comment?: string
  ): Promise<void> {
    const now = new Date();
    
    // Get current request
    const requests = await this.sql`
      select * from admin_approval_requests
      where id = ${requestId} and tenant_slug = ${tenantSlug}
    `;

    if (requests.length === 0) throw new Error("Request not found");

    const request = requests[0];
    const history = Array.isArray(request.history) ? request.history : [];
    
    history.push({
      stepId: `step-${request.current_step_index}`,
      actionBy,
      action: approvalAction,
      timestamp: now,
      comment,
    });

    let newStatus: ApprovalStatus = "pending";
    if (approvalAction === "approve") {
      newStatus = "approved";
    } else if (approvalAction === "reject") {
      newStatus = "rejected";
    }

    await this.sql`
      update admin_approval_requests
      set status = ${newStatus}, history = ${JSON.stringify(history)}, updated_at = ${now}
      where id = ${requestId} and tenant_slug = ${tenantSlug}
    `;
  }
}

/**
 * Workflow Service
 */
export class WorkflowService {
  constructor(private sql: SqlClient = SQL) {}

  async createWorkflow(tenantSlug: TenantSlug, workflow: Workflow): Promise<ResourceId> {
    const id = randomUUID() as ResourceId;
    const now = new Date();

    await this.sql`
      insert into admin_workflows (id, tenant_slug, name, type, trigger, steps, status, is_active, description, created_at, updated_at)
      values (${id}, ${tenantSlug}, ${workflow.name}, ${workflow.type}, ${workflow.trigger}, ${JSON.stringify(workflow.steps)}, ${workflow.status}, ${workflow.isActive}, ${workflow.description || null}, ${now}, ${now})
    `;

    return id;
  }

  async executeWorkflow(tenantSlug: TenantSlug, workflowId: ResourceId, triggeredBy: UserId): Promise<string> {
    const executionId = randomUUID();
    const now = new Date();

    await this.sql`
      insert into admin_workflow_executions (id, tenant_slug, workflow_id, triggered_by, current_step_id, status, execution_history, created_at, updated_at)
      values (${executionId}, ${tenantSlug}, ${workflowId}, ${triggeredBy}, '', 'running', '[]', ${now}, ${now})
    `;

    return executionId;
  }

  async completeWorkflow(tenantSlug: TenantSlug, executionId: string, status: "completed" | "failed"): Promise<void> {
    await this.sql`
      update admin_workflow_executions
      set status = ${status}, updated_at = ${new Date()}
      where id = ${executionId} and tenant_slug = ${tenantSlug}
    `;
  }
}

/**
 * Module Registry Service
 */
export class ModuleService {
  constructor(private sql: SqlClient = SQL) {}

  async getAll(tenantSlug: TenantSlug): Promise<Module[]> {
    return this.sql`select * from admin_modules where tenant_slug = ${tenantSlug} order by name`;
  }

  async getEnabled(tenantSlug: TenantSlug): Promise<Module[]> {
    return this.sql`select * from admin_modules where tenant_slug = ${tenantSlug} and enabled = true order by name`;
  }

  async toggleModule(tenantSlug: TenantSlug, moduleId: ResourceId, enabled: boolean): Promise<void> {
    await this.sql`
      update admin_modules
      set enabled = ${enabled}, updated_at = ${new Date()}
      where id = ${moduleId} and tenant_slug = ${tenantSlug}
    `;
  }

  async setFeatureFlag(tenantSlug: TenantSlug, moduleId: ResourceId, flag: FeatureFlag): Promise<void> {
    // Implementation depends on your feature flag storage strategy
    await this.sql`
      update admin_modules
      set feature_flags = jsonb_set(feature_flags, ${`{${flag.key}}`}, ${JSON.stringify(flag)})
      where id = ${moduleId} and tenant_slug = ${tenantSlug}
    `;
  }
}

/**
 * Audit Service
 */
export class AuditService {
  constructor(private sql: SqlClient = SQL) {}

  async log(
    tenantSlug: TenantSlug,
    userId: UserId,
    action: AuditAction,
    resource: string,
    resourceId: ResourceId,
    changes?: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    const id = randomUUID();
    const now = new Date();

    await this.sql`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${id}, ${tenantSlug}, ${userId}, ${action}, ${resource}, ${resourceId}, ${changes ? JSON.stringify(changes) : null}, ${ipAddress || null}, ${now})
    `;
  }

  async getForResource(tenantSlug: TenantSlug, resource: string, resourceId: ResourceId): Promise<AuditLog[]> {
    return this.sql`
      select * from admin_audit_logs
      where tenant_slug = ${tenantSlug} and resource = ${resource} and resource_id = ${resourceId}
      order by created_at desc
      limit 100
    `;
  }

  async getForUser(tenantSlug: TenantSlug, userId: UserId): Promise<AuditLog[]> {
    return this.sql`
      select * from admin_audit_logs
      where tenant_slug = ${tenantSlug} and user_id = ${userId}
      order by created_at desc
      limit 100
    `;
  }
}
