import { postFormData } from "./client";
import { ApiError } from "./shared";
import { v4 as uuidv4 } from "uuid";

// Keep the exact body/key after a timeout or lost response. Retrying must never
// silently turn edited fields into another financial operation.
export class FinancialSubmission {
  private pending: { key: string; body: FormData; path: string } | null = null;
  private unresolved = false;

  get isUnresolved() { return this.unresolved; }

  async submit(path: string, body: FormData) {
    if (!this.pending) {
      const snapshot = new FormData();
      for (const [name, value] of body) snapshot.append(name, value);
      // getRandomValues remains available on HTTP LAN origins. Let the proven
      // UUID library encode those cryptographic bytes with the required v4 bits.
      this.pending = { key: uuidv4({ random: crypto.getRandomValues(new Uint8Array(16)) }), body: snapshot, path };
    }
    if (path !== this.pending.path) throw new ApiError("Retry the original financial submission first.", 409);
    try {
      const result = await postFormData(path, this.pending.body, { "Idempotency-Key": this.pending.key });
      this.pending = null;
      this.unresolved = false;
      return result;
    } catch (error) {
      // A retry of an earlier uncertain write may hit a rate/access limit even
      // though the original committed. Do not forget that original operation.
      if (!this.unresolved && error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 409].includes(error.status)) {
        this.pending = null;
      } else {
        this.unresolved = true;
      }
      throw error;
    }
  }
}
