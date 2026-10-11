// Only an operator's explicit configuration can allow another host to access
// Next's development assets/HMR. Never derive this list from incoming headers.
export function developmentOrigins(value: string | undefined): string[] {
  return [...new Set((value || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean).map((host) => {
    if (host.includes("*")) throw new Error("Development origins must be explicit hostnames, without wildcards.");
    const url = new URL(`http://${host}`);
    if (url.hostname !== host || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Development origins must be hostnames, without scheme, port or path.");
    }
    return host;
  }))];
}
