"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { roleMeta } from "@/lib/navigation";
import type { AppRole } from "@/types";

const defaultRole: AppRole = "FINANCIAL_CONTROLLER";

type RolePreviewContextValue = {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
  roles: AppRole[];
};

const RolePreviewContext = createContext<RolePreviewContextValue | null>(null);

export function RolePreviewProvider({
  children,
  initialRole = defaultRole,
  roles,
}: {
  children: React.ReactNode;
  initialRole?: AppRole;
  roles?: AppRole[];
}) {
  const availableRoles = useMemo(
    () => (roles && roles.length > 0 ? roles : (Object.keys(roleMeta) as AppRole[])),
    [roles],
  );
  const fallbackRole = availableRoles[0] ?? initialRole;
  const [activeRole, setActiveRole] = useState<AppRole>(initialRole);

  const value = useMemo(
    () => ({
      activeRole,
      setActiveRole,
      roles: availableRoles,
    }),
    [activeRole, availableRoles],
  );

  return (
    <RolePreviewContext.Provider value={value}>
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  const context = useContext(RolePreviewContext);

  if (!context) {
    throw new Error("useRolePreview must be used inside RolePreviewProvider.");
  }

  return context;
}
