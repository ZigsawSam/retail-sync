"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ERPRole } from "../types";
import { isRouteAllowedForRole, DEFAULT_ROUTE_FOR_ROLE } from "../lib/rolePermissions";

interface RoleGuardProps {
  currentRole: ERPRole;
  children: React.ReactNode;
}

/**
 * Enforces per-route access by role. The Sidebar already hides nav links a
 * role shouldn't see, but that alone doesn't stop someone from typing a
 * restricted URL directly (e.g. a cashier navigating to /people or /ai).
 * This component is the actual enforcement layer.
 */
export default function RoleGuard({ currentRole, children }: RoleGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = (!pathname || pathname === "/") ? "dashboard" : (pathname.split("/")[1] || "dashboard");
  const allowed = isRouteAllowedForRole(activeTab, currentRole);

  useEffect(() => {
    if (!allowed) {
      router.replace(`/${DEFAULT_ROUTE_FOR_ROLE[currentRole]}`);
    }
  }, [allowed, currentRole, router]);

  // Avoid flashing restricted content while the redirect above kicks in.
  if (!allowed) return null;

  return <>{children}</>;
}
