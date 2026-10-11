import { createConnection } from "node:net";
import { AppError } from "./app-error";

export type ClamdConfig = { host: string; port: number; timeoutMs: number };
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_REPLY_BYTES = 4096;

// ClamAV is the scanner. This adapter only implements its documented INSTREAM
// framing, bounded transport and an exact allow-list for a clean verdict.
// https://docs.clamav.net/manual/Usage/ClamdProtocol.html
export function scanClamdBuffer(buffer: Buffer, config: ClamdConfig): Promise<void> {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_INPUT_BYTES) return Promise.reject(new AppError(400, "Upload size is invalid for scanning."));
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port });
    let settled = false; let sent = false; let size = 0; let offset = 0;
    const replies: Buffer[] = [];
    const finish = (error?: AppError) => {
      if (settled) return;
      settled = true; clearTimeout(deadline); socket.destroy();
      if (error) reject(error); else resolve();
    };
    const unavailable = () => finish(new AppError(503, "File scanning is unavailable. Please try again later."));
    // Absolute deadline, including DNS/connect/send/read; slow trickle cannot
    // reset it. Every result destroys the socket; no dangling race promises.
    const deadline = setTimeout(unavailable, config.timeoutMs);
    socket.on("error", unavailable);
    socket.on("close", () => { if (!settled) unavailable(); });
    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_REPLY_BYTES) { unavailable(); return; }
      replies.push(chunk);
    });
    socket.on("end", () => {
      if (settled) return;
      const verdict = Buffer.concat(replies, size).toString("utf8");
      if (!sent) { unavailable(); return; }
      if (verdict === "stream: OK\0") finish();
      else if (/^stream: [^\0\r\n]+ FOUND\0$/.test(verdict)) finish(new AppError(422, "The uploaded file did not pass security scanning."));
      else unavailable(); // Errors, truncated/multiple/malformed replies fail closed.
    });
    const send = () => {
      if (settled) return;
      while (offset < buffer.length) {
        const chunk = buffer.subarray(offset, Math.min(buffer.length, offset + 32 * 1024));
        const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length); offset += chunk.length;
        socket.cork(); socket.write(length); const ready = socket.write(chunk); socket.uncork();
        if (!ready) { socket.once("drain", send); return; }
      }
      if (!sent) { sent = true; socket.write(Buffer.alloc(4)); }
    };
    socket.once("connect", () => { socket.write(Buffer.from("zINSTREAM\0")); send(); });
  });
}
