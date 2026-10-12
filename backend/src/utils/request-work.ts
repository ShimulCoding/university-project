import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Socket } from "node:net";

// Server-owned response bindings keep different createApp instances isolated.
// A closed socket does not end the controller promise or its database work.
const responseWork = new WeakMap<Response, RequestWork>();

export class RequestWork {
  private draining = false;
  private active = 0;
  private readonly idleListeners = new Set<() => void>();

  get isReady() { return !this.draining; }
  get activeCount() { return this.active; }

  startDraining() { this.draining = true; }

  begin(): (() => void) | null {
    if (this.draining) return null;
    this.active++;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.active--;
      if (this.active === 0) {
        for (const notify of this.idleListeners) notify();
        this.idleListeners.clear();
      }
    };
  }

  track<T>(action: () => Promise<T>): Promise<T> {
    const finish = this.begin();
    if (!finish) return Promise.reject(new Error("Server work is draining."));
    return Promise.resolve().then(action).finally(finish);
  }

  waitForIdle() {
    if (this.active === 0) return { promise: Promise.resolve(), cancel: () => {} };
    let notify!: () => void;
    const promise = new Promise<void>((resolve) => { notify = resolve; this.idleListeners.add(notify); });
    return { promise, cancel: () => { this.idleListeners.delete(notify); } };
  }
}

export function rejectDrainingRequest(response: Response) {
  if (response.destroyed || response.writableEnded) return;
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Retry-After", "5");
  response.setHeader("Connection", "close");
  response.status(503).json({ message: "The server is restarting. Please retry shortly." });
}

export function requestIsDraining(response: Response) {
  return responseWork.get(response)?.isReady === false;
}

export function bindRequestWork(work: RequestWork): RequestHandler {
  return (_request, response, next) => {
    responseWork.set(response, work);
    if (!work.isReady) { rejectDrainingRequest(response); return; }
    next();
  };
}

export function readinessHandler(work: RequestWork): RequestHandler {
  return (_request, response) => {
    response.setHeader("Cache-Control", "private, no-store");
    if (!work.isReady) response.setHeader("Retry-After", "5");
    response.status(work.isReady ? 200 : 503).json({ status: work.isReady ? "ready" : "draining" });
  };
}

export function beginTrackedWork(response: Response): (() => void) | null {
  if (response.destroyed || response.writableEnded) return null;
  const work = responseWork.get(response);
  if (!work) return () => {}; // Standalone middleware fixtures have no app registry.
  const finish = work.begin();
  if (!finish) rejectDrainingRequest(response);
  return finish;
}

// Preserve the actual promise for Express 5 and direct middleware callers.
// Unlike asyncHandler this wrapper awaits the middleware, including its reads.
export function trackRequestMiddleware(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const finish = beginTrackedWork(response);
    if (!finish) return;
    try { await handler(request, response, next); } finally { finish(); }
  };
}

export type ShutdownResult =
  | { status: "completed"; unfinishedWork: 0 }
  | { status: "failed"; reason: "deadline" | "cleanup"; unfinishedWork: number };

export function createGracefulShutdown(options: {
  server: Server;
  work: RequestWork;
  disconnect: () => Promise<void>;
  stopMaintenance: () => void;
  deadlineMs?: number;
}) {
  const deadlineMs = options.deadlineMs ?? 60_000;
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 300_000) throw new Error("Invalid shutdown deadline.");
  let pending: Promise<ShutdownResult> | undefined;
  let closing = false;
  // Register before accepting connections. Node's HTTP idle-connection helper
  // can miss speculative TCP connections that have never sent a request.
  // Do not force-close sockets delivering accepted responses or private files.
  const awaitingRequest = new Set<Socket>();
  const connected = (socket: Socket) => {
    if (closing) { socket.destroy(); return; }
    awaitingRequest.add(socket);
    socket.once("close", () => awaitingRequest.delete(socket));
  };
  const requested = (request: IncomingMessage, response: ServerResponse) => {
    awaitingRequest.delete(request.socket);
    response.once("finish", () => {
      // Let Node finish its response bookkeeping before closing only idle
      // keep-alive sockets; never truncate an accepted file/response stream.
      if (closing) setImmediate(() => options.server.closeIdleConnections());
    });
  };
  options.server.on("connection", connected);
  options.server.on("request", requested);
  return () => {
    if (pending) return pending;
    closing = true;
    options.work.startDraining();
    for (const socket of awaitingRequest) socket.destroy();
    awaitingRequest.clear();
    let maintenanceFailed = false;
    try { options.stopMaintenance(); } catch { maintenanceFailed = true; }
    const idle = options.work.waitForIdle();
    const socketsClosed = new Promise<void>((resolve, reject) => {
      options.server.close((error?: Error) => {
        if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
        else resolve();
      });
    });
    pending = new Promise<ShutdownResult>((resolve) => {
      let settled = false;
      const finish = (result: ShutdownResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        idle.cancel();
        options.server.off("connection", connected);
        options.server.off("request", requested);
        if (result.status === "failed") options.server.closeAllConnections();
        resolve(result);
      };
      // Keep this timer referenced: an unresolved promise alone cannot keep
      // Node alive after its client socket closes.
      const timer = setTimeout(() => finish({ status: "failed", reason: "deadline", unfinishedWork: options.work.activeCount }), deadlineMs);
      void Promise.all([socketsClosed, idle.promise]).then(async () => {
        if (settled) return; // A timed-out operation must never disconnect later.
        if (maintenanceFailed) throw new Error("Maintenance shutdown failed.");
        await options.disconnect();
        finish({ status: "completed", unfinishedWork: 0 });
      }).catch(() => finish({ status: "failed", reason: "cleanup", unfinishedWork: options.work.activeCount }));
    });
    return pending;
  };
}

export function exitFailedShutdown(result: Extract<ShutdownResult, { status: "failed" }>) {
  // Flush only fixed diagnostic fields; never print an error, request or actor.
  // A broken stderr stream must not defeat the already failed shutdown bound.
  const fallback = setTimeout(() => process.exit(1), 250);
  try {
    process.stderr.write(`${JSON.stringify({ event: "shutdown.failed", reason: result.reason, unfinishedWork: result.unfinishedWork })}\n`, () => {
      clearTimeout(fallback);
      process.exit(1);
    });
  } catch { clearTimeout(fallback); process.exit(1); }
}
