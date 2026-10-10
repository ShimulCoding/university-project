// This runs on the server per request. Expiry is a recovery hint, never authorization.
export function accessCookieExpired(access: string | undefined) {
  try {
    const payload = JSON.parse(Buffer.from(access?.split(".")[1] || "", "base64url").toString("utf8"));
    return typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now();
  } catch { return true; }
}
