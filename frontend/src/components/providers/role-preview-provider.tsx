"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { roleMeta } from "@/lib/navigation";
import type { AppRole } from "@/types";

const rolePreviewStorageKey = "mu-cse-role-preview";
const defaultRole: AppRole = "FINANCIAL_CONTROLLER";

type RolePreviewContextValue = {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
  roles: AppRole[];
};

const RolePreviewContext = createContext<RolePreviewContextValue | null>(null);

export function RolePreviewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeRole, setActiveRole] = useState<AppRole>(defaultRole);

  useEffect(() => {
    const storedRole = window.localStorage.getItem(rolePreviewStorageKey) as
      | AppRole
      | null;

    if (storedRole && storedRole in roleMeta) {
      setActiveRole(storedRole);
    }
  }, []);

  const handleSetActiveRole = (role: AppRole) => {
    setActiveRole(role);
    window.localStorage.setItem(rolePreviewStorageKey, role);
  };

  const value = useMemo(
    () => ({
      activeRole,
      setActiveRole: handleSetActiveRole,
      roles: Object.keys(roleMeta) as AppRole[],
    }),
    [activeRole],
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
