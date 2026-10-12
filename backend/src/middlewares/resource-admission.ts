import type { RequestHandler } from "express";
import type { Response } from "express";
import type { AsyncRequestHandler } from "../utils/async-handler";
import { beginTrackedWork, rejectDrainingRequest, requestIsDraining } from "../utils/request-work";

const responseLeases = new WeakMap<Response, { begin: () => (() => void) | null }>();

// Controller/service promises may outlive a disconnected HTTP response. Track
// their work under the upload lease so socket close cannot release buffers early.
export function beginAdmittedWork(response: Response): (() => void) | null {
  if (response.destroyed || response.writableEnded) return null;
  const lease = responseLeases.get(response);
  return lease ? lease.begin() : (() => {});
}

export function createResourceAdmission(maxConcurrent: number, message: string): RequestHandler {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) throw new Error("Invalid resource admission limit.");
  let active = 0;
  return (_request, response, next) => {
    if (requestIsDraining(response)) { rejectDrainingRequest(response); return; }
    if (active >= maxConcurrent) {
      response.setHeader("Retry-After", "5");
      response.status(503).json({ message });
      return;
    }
    active++;
    let released = false, closed = false, working = 0;
    const release = () => { if (closed && working === 0 && !released) { released = true; active--; } };
    responseLeases.set(response, { begin: () => {
      if (closed || released) return null;
      working++;
      let finished = false;
      return () => { if (!finished) { finished = true; working--; release(); } };
    } });
    const close = () => { closed = true; release(); };
    response.once("finish", close);
    response.once("close", close);
    next();
  };
}

// A disconnected client does not cancel an in-flight Prisma transaction. Keep
// expensive work admitted until its promise settles, even after socket close.
export function createWorkAdmission(maxConcurrent: number, message: string) {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) throw new Error("Invalid resource admission limit.");
  let active = 0;
  return (handler: AsyncRequestHandler): RequestHandler => (request, response, next) => {
    if (response.destroyed || response.writableEnded) return;
    if (requestIsDraining(response)) { rejectDrainingRequest(response); return; }
    if (active >= maxConcurrent) {
      response.setHeader("Retry-After", "5");
      response.status(503).json({ message });
      return;
    }
    const finishWork = beginTrackedWork(response);
    if (!finishWork) return;
    active++;
    void Promise.resolve().then(() => handler(request, response, next)).catch(next).finally(() => { active--; finishWork(); });
  };
}
