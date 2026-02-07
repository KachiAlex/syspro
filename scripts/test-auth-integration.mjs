#!/usr/bin/env node
/**
 * Test script for Auth Integration Phase 1
 * 
 * This script tests the improved user-permissions endpoint
 * with different user roles and headers
 */

const BASE_URL = "http://localhost:3000";
const TENANT_SLUG = "kreatix-default";

async function testPermissionsEndpoint(userId, roleId, userName = "Test User") {
  console.log(`\n📧 Testing as ${roleId} (${userName})...`);
  
  const url = `${BASE_URL}/api/tenant/user-permissions?tenantSlug=${TENANT_SLUG}`;
  
  const headers = {
    "X-User-Id": userId,
    "X-User-Email": `${roleId}@example.com`,
    "X-User-Name": userName,
    "X-Tenant-Slug": TENANT_SLUG,
    "X-Role-Id": roleId,
  };

  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`❌ Status: ${response.status}`);
      const error = await response.json();
      console.error("Error:", error);
      return;
    }

    const data = await response.json();
    const permissions = data.permissions;

    console.log(`✅ Status:200`);
    console.log(`   Role: ${permissions.role}`);
    console.log(`   User ID: ${permissions.userId}`);
    console.log(`   Tenant: ${permissions.tenantSlug}`);
    
    // Check specific module permissions
    const crm = permissions.modules.crm;
    const finance = permissions.modules.finance;
    const admin = permissions.modules.admin;
    
    console.log(`   Module Access:`);
    console.log(`     - CRM: ${crm}`);
    console.log(`     - Finance: ${finance}`);
    console.log(`     - Admin: ${admin}`);
    console.log(`   Features: ${permissions.features.join(", ")}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("RBAC Auth Integration - Phase 1 Test");
  console.log("=".repeat(60));
  console.log(`Testing endpoint: /api/tenant/user-permissions`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant: ${TENANT_SLUG}`);

  // Test different roles
  await testPermissionsEndpoint("user-admin-001", "admin", "Admin User");
  await testPermissionsEndpoint("user-manager-001", "manager", "Manager User");
  await testPermissionsEndpoint("user-editor-001", "editor", "Editor User");
  await testPermissionsEndpoint("user-viewer-001", "viewer", "Viewer User");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Tests completed!");
  console.log("=".repeat(60));
  process.exit(0);
}

// Run tests
runTests().catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
