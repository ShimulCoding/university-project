"use client";

import { roleMeta } from "@/lib/navigation";
import type { AppRole } from "@/types";
import { useRolePreview } from "@/components/providers/role-preview-provider";
import { Select } from "@/components/ui/select";

export function RolePreviewSwitcher() {
  const { activeRole, setActiveRole, roles } = useRolePreview();

  return (
    <div className="w-full min-w-[220px] max-w-[280px]">
      <Select
        value={activeRole}
        onChange={(event) => setActiveRole(event.target.value as AppRole)}
        options={roles.map((role) => ({
          value: role,
          label: roleMeta[role].label,
        }))}
      />
    </div>
  );
}
