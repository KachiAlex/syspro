import React from "react";
export const dynamic = "force-dynamic";

import ServerSidebar from "@/components/layout/server-sidebar";
import TenantAdminClientWrapper from "@/components/tenant-admin-client-wrapper";

export default function AdminTenantAdminPage() {
	return (
		<div className="min-h-screen bg-theme-muted">
			<div className="max-w-7xl mx-auto px-4 py-8 lg:flex lg:items-start lg:gap-6">
				<aside className="w-full max-w-xs flex-shrink-0 hidden lg:block border-r border-theme-border pr-6">
					<ServerSidebar />
				</aside>
				<main className="flex-1">
					<h1 className="text-3xl font-bold text-theme-text-primary">Tenant Admin</h1>
					<p className="text-theme-text-secondary mt-2">Welcome to the tenant administration panel.</p>
				</main>
			</div>
		</div>
	);
}
