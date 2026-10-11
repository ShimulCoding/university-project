import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { beginAdmittedWork, createResourceAdmission, createWorkAdmission } from "../src/middlewares/resource-admission";
import { asyncHandler } from "../src/utils/async-handler";

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function response() {
  return Object.assign(new EventEmitter(), { destroyed: false, code: 200,
    setHeader() {}, status(code: number) { this.code = code; return this; }, json() { return this; },
  });
}
async function main() {
  let checks = 0, entered = 0, admitted = 0;
  const check = (condition: unknown, message: string) => { assert(condition, message); checks++; };
  const releases: (() => void)[] = [];
  const gate = createResourceAdmission(2, "Synthetic busy");
  const handler = asyncHandler(async () => { entered++; await new Promise<void>(resolve => releases.push(resolve)); });
  const request = {} as Request;
  const first = response(), second = response(), third = response();
  gate(request, first as unknown as Response, () => handler(request, first as unknown as Response, () => {}));
  gate(request, second as unknown as Response, () => handler(request, second as unknown as Response, () => {}));
  await tick(); check(entered === 2, "Allowed work did not begin");
  first.destroyed = true; second.destroyed = true; first.emit("close"); second.emit("close"); first.emit("finish");
  gate(request, third as unknown as Response, () => { admitted++; });
  check(third.code === 503 && admitted === 0, "Closed sockets freed still-running upload leases");
  releases.shift()!(); await tick();
  const afterWork = response(); gate(request, afterWork as unknown as Response, () => { admitted++; });
  check(afterWork.code === 200 && admitted === 1, "Settled cancelled work did not release exactly one slot");
  afterWork.emit("close"); afterWork.emit("finish");
  releases.shift()!(); await tick();
  const parsed = response(); gate(request, parsed as unknown as Response, () => { admitted++; }); parsed.emit("close"); parsed.emit("finish");
  const next = response(); gate(request, next as unknown as Response, () => { admitted++; });
  check(next.code === 200 && admitted === 3, "Cancellation before controller work leaked admission"); next.emit("finish");
  check(beginAdmittedWork(next as unknown as Response) === null, "Finished response began late controller work");
  const dead = response(); dead.destroyed = true;
  asyncHandler(async () => { entered++; })(request, dead as unknown as Response, () => {}); await tick();
  check(entered === 2, "Dead response began another expensive controller");
  let errors = 0;
  const failed = response();
  gate(request, failed as unknown as Response, () => asyncHandler(async () => { throw new Error("Synthetic"); })(request, failed as unknown as Response, () => { errors++; failed.emit("finish"); }));
  await tick(); check(errors === 1, "Controller error did not reach controlled error handling");
  const recovered = response(); gate(request, recovered as unknown as Response, () => { admitted++; });
  check(recovered.code === 200, "Error path leaked upload lease"); recovered.emit("finish");

  const workGate = createWorkAdmission(1, "Synthetic job busy");
  let complete!: () => void;
  const job = workGate(async () => { await new Promise<void>(resolve => { complete = resolve; }); });
  const jobResponse = response(); job(request, jobResponse as unknown as Response, () => {}); await tick();
  jobResponse.destroyed = true; jobResponse.emit("close");
  const blockedJob = response(); job(request, blockedJob as unknown as Response, () => {});
  check(blockedJob.code === 503, "Disconnected job released unfinished aggregation");
  complete(); await tick();
  const badJob = workGate(async () => { throw new Error("Synthetic"); });
  badJob(request, response() as unknown as Response, () => { errors++; }); await tick();
  badJob(request, response() as unknown as Response, () => { errors++; }); await tick();
  check(errors === 3, "Work rejection leaked the job slot");
  assert.throws(() => createResourceAdmission(0, "Synthetic")); checks++;
  assert.throws(() => createWorkAdmission(0, "Synthetic")); checks++;
  console.log(`Resource admission lifecycle: ${checks} cancellation/completion/error/late-work checks passed.`);
}
void main().catch((error) => { console.error(error.message); process.exitCode = 1; });
