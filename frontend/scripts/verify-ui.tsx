import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import PageError from "../src/app/error";
import { queryPage } from "../src/lib/api/list";

// A segment error boundary is rendered inside the existing document layout.
const markup = renderToStaticMarkup(<PageError error={Object.assign(new Error("Private failure details"), { digest: "audit-digest" })} reset={() => {}} />);
assert(!/<\/?(?:html|body)(?:\s|>)/i.test(markup), "Segment errors must not nest document elements");
assert(markup.includes("audit-digest"));
assert(!markup.includes("Private failure details"), "Do not expose raw server errors");
assert(markup.includes("Retry page") && markup.includes("Return home"));
assert.equal(queryPage("2"), "2");
for (const invalid of [undefined, "0", "-1", "1.5", "9007199254740992", ["2", "3"]]) assert.equal(queryPage(invalid), "1");
console.log("UI verification passed: valid error markup, safe details, recovery controls, and bounded page queries.");
