import { describe, expect, it } from "vitest";

import { effectiveViewMode } from "@/lib/crm/auth";
import { hasPermission } from "@/lib/auth-helper";

describe("crm effectiveViewMode scope clamping", () => {
  it("staff scope always clamps to mine regardless of requested viewMode", () => {
    expect(effectiveViewMode(undefined, "mine")).toBe("mine");
    expect(effectiveViewMode("mine", "mine")).toBe("mine");
    expect(effectiveViewMode("team", "mine")).toBe("mine");
    expect(effectiveViewMode("all", "mine")).toBe("mine");
  });

  it("hod/team scope caps at team", () => {
    expect(effectiveViewMode(undefined, "team")).toBe("team");
    expect(effectiveViewMode("team", "team")).toBe("team");
    expect(effectiveViewMode("all", "team")).toBe("team");
    expect(effectiveViewMode("mine", "team")).toBe("mine");
  });

  it("admin scope honors requested viewMode", () => {
    expect(effectiveViewMode(undefined, "all")).toBe("all");
    expect(effectiveViewMode("all", "all")).toBe("all");
    expect(effectiveViewMode("team", "all")).toBe("team");
    expect(effectiveViewMode("mine", "all")).toBe("mine");
  });
});

describe("role permission matrix", () => {
  it("admin-level roles can delete", () => {
    for (const role of ["admin", "tenant_admin", "superadmin"]) {
      expect(hasPermission(role, "delete")).toBe(true);
    }
  });

  it("write-capable roles cannot delete", () => {
    for (const role of ["manager", "operator", "editor", "hod", "executive"]) {
      expect(hasPermission(role, "write")).toBe(true);
      expect(hasPermission(role, "delete")).toBe(false);
    }
  });

  it("staff/viewer are read-only", () => {
    for (const role of ["staff", "viewer"]) {
      expect(hasPermission(role, "read")).toBe(true);
      expect(hasPermission(role, "write")).toBe(false);
    }
  });

  it("unknown roles have no permissions; undefined defaults to read-only", () => {
    expect(hasPermission(undefined, "read")).toBe(true);
    expect(hasPermission(undefined, "write")).toBe(false);
    expect(hasPermission("nonexistent", "read")).toBe(false);
  });
});
