import React from "react";
export const dynamic = "force-dynamic";

import ServerSidebar from "@/components/layout/server-sidebar";
import TenantAdminClientWrapper from "@/components/tenant-admin-client-wrapper";

try {
	// Log when this server page is executed to help diagnose server vs client rendering
	// This will appear in the Next.js server logs when the server branch runs.
	// eslint-disable-next-line no-console
	console.log("ADMIN_PAGE_SERVER_RENDER: admin/tenant-admin executed on server");
} catch (e) {
	// noop
}

export default function AdminTenantAdminPage() {
	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-7xl mx-auto px-4 py-8 lg:flex lg:items-start lg:gap-6">
				<aside className="w-full max-w-xs flex-shrink-0 hidden lg:block border-r border-gray-200 pr-6">
					<ServerSidebar />
				</aside>
				<main className="flex-1">
					<h1 className="text-3xl font-bold text-gray-900">Tenant Admin</h1>
					<p className="text-gray-600 mt-2">Welcome to the tenant administration panel.</p>
				</main>
			</div>
		</div>
	);
}
