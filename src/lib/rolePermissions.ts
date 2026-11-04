import { ERPRole } from "../types";

// Single source of truth for which roles can access which top-level route.
// Keep this in sync with the menuItems `roles` arrays in Sidebar.tsx.
export const ROUTE_ROLES: Record<string, ERPRole[]> = {
  dashboard: ["admin", "inventory_manager", "cashier"],
  sales: ["admin", "cashier"],
  people: ["admin"],
  operations: ["admin", "inventory_manager"],
  insights: ["admin", "cashier"],
  ai: ["admin"],
  settings: ["admin"],
};

// Where to send a role if they land on / land on a route they can't access.
export const DEFAULT_ROUTE_FOR_ROLE: Record<ERPRole, string> = {
  admin: "dashboard",
  cashier: "sales",
  inventory_manager: "operations",
};

export function isRouteAllowedForRole(route: string, role: ERPRole): boolean {
  const allowed = ROUTE_ROLES[route];
  // Unknown routes (e.g. not-found) are not gated here.
  if (!allowed) return true;
  return allowed.includes(role);
}
