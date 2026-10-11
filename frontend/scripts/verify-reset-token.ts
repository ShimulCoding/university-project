import assert from "node:assert/strict";
import { resolveResetToken } from "../src/lib/reset-token";

const token = "synthetic-capability";
const cases: [string | undefined, string | null, string | null | undefined][] = [
  [undefined, null, undefined], [undefined, token, undefined],
  [`#token=${token}`, null, token], [`token=${token}`, null, token],
  ["", token, token], ["#view=form", token, token], ["", null, null],
  [`#token=${token}`, "other", token], ["#token=", token, null],
  [`#token=${token}&token=other`, token, null], ["#token=%", null, "%"],
  ["#token=a%2Bb", null, "a+b"], ["#token=%3Cscript%3E", null, "<script>"],
  [`#token=${"a".repeat(129)}`, null, null], ["", "a".repeat(129), null],
  [`#view=${"x".repeat(1024)}`, token, null],
];
for (const [fragment, legacy, expected] of cases) assert.equal(resolveResetToken(fragment, legacy), expected);
// The value is opaque data submitted in JSON, never interpreted as HTML or code.
console.log(`Reset capability parser: ${cases.length} hydration/fragment/legacy/ambiguity/bounds checks passed.`);
