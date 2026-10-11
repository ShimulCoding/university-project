import { isIP } from "node:net";
import type { AuditMetadata } from "../modules/audit/types/audit.types";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const families = new Set(["Edge", "Chrome", "Firefox", "Safari", "Other"]);
function browserFamily(value: string) {
  if (families.has(value)) return value;
  if (/\bEdg\//.test(value)) return "Edge";
  if (/\bFirefox\//.test(value)) return "Firefox";
  if (/\bChrome\//.test(value)) return "Chrome";
  if (/\bSafari\//.test(value)) return "Safari";
  return "Other";
}

export function sanitizeAuditMetadata(input: AuditMetadata): AuditMetadata {
  return {
    ipAddress: input.ipAddress && isIP(input.ipAddress) ? input.ipAddress : undefined,
    userAgent: input.userAgent ? browserFamily(input.userAgent) : undefined,
    route: input.route ? input.route.split(/[?#]/, 1)[0]!.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 512) : undefined,
    method: input.method && methods.has(input.method) ? input.method : undefined,
  };
}
