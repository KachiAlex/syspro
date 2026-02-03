"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AccessControlPanel from "./sections/access-control";
import AnalyticsPanel from "./sections/analytics";
import ApprovalDesigner from "./sections/approval-designer";
import BillingPanel from "./sections/billing";
import CostAllocationPanel from "./sections/cost-allocation";
import DepartmentManagement from "./sections/department-management";
import EmployeeConsole from "./sections/employee-console";
import IntegrationsPanel from "./sections/integrations";
import ModuleRegistry from "./sections/module-registry";
import RoleBuilder from "./sections/role-builder";
import SecurityPanel from "./sections/security";
import WorkflowsPanel from "./sections/workflows";

export default function TenantAdminPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Admin</h1>
          <p className="text-muted-foreground">Manage your tenant settings and configurations</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          Active
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 lg:grid-cols-14">
          <TabsTrigger value="overview" className="col-span-2">Overview</TabsTrigger>
          <TabsTrigger value="access" className="col-span-2">Access</TabsTrigger>
          <TabsTrigger value="employees" className="col-span-2">Employees</TabsTrigger>
          <TabsTrigger value="departments" className="col-span-2">Departments</TabsTrigger>
          <TabsTrigger value="roles" className="col-span-2">Roles</TabsTrigger>
          <TabsTrigger value="workflows" className="col-span-2">Workflows</TabsTrigger>
          <TabsTrigger value="billing" className="col-span-2">Billing</TabsTrigger>
          <TabsTrigger value="analytics" className="col-span-2">Analytics</TabsTrigger>
          <TabsTrigger value="security" className="col-span-2">Security</TabsTrigger>
          <TabsTrigger value="integrations" className="col-span-2">Integrations</TabsTrigger>
          <TabsTrigger value="modules" className="col-span-2">Modules</TabsTrigger>
          <TabsTrigger value="approvals" className="col-span-2">Approvals</TabsTrigger>
          <TabsTrigger value="costs" className="col-span-2">Costs</TabsTrigger>
          <TabsTrigger value="vendors" className="col-span-2">Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Access Control</CardTitle>
                <CardDescription>Manage user permissions and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Configure role-based access control for your tenant.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Employee Management</CardTitle>
                <CardDescription>Manage employee accounts and profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Add, edit, and manage employee information.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Department Structure</CardTitle>
                <CardDescription>Organizational departments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Define and manage department hierarchies.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Workflow Automation</CardTitle>
                <CardDescription>Business process workflows</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Create and automate business workflows.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Billing & Subscription</CardTitle>
                <CardDescription>Manage billing and plans</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">View billing history and manage subscriptions.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analytics & Reports</CardTitle>
                <CardDescription>Usage and performance analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Monitor tenant usage and generate reports.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="access">
          <AccessControlPanel />
        </TabsContent>

        <TabsContent value="employees">
          <EmployeeConsole />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentManagement />
        </TabsContent>

        <TabsContent value="roles">
          <RoleBuilder />
        </TabsContent>

        <TabsContent value="workflows">
          <WorkflowsPanel />
        </TabsContent>

        <TabsContent value="billing">
          <BillingPanel />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPanel />
        </TabsContent>

        <TabsContent value="security">
          <SecurityPanel />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsPanel />
        </TabsContent>

        <TabsContent value="modules">
          <ModuleRegistry />
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalDesigner />
        </TabsContent>

        <TabsContent value="costs">
          <CostAllocationPanel />
        </TabsContent>

        <TabsContent value="vendors">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Management</CardTitle>
                <CardDescription>Manage vendor relationships and contracts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Vendor management functionality is available through the main Finance module.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
