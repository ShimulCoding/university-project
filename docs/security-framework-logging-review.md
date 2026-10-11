# SEC-25: raw Next development logging

**Medium (development/staging log privacy), fixed.** At `dfff62e`, `frontend/next.config.ts:3` does not configure logging and `frontend/src/app/reset-password/page.tsx:19` consumes the recovery token from the URL query. Installed Next 16.4.0 `node_modules/next/dist/server/dev/log-requests.js:100` prints the incoming URL. Captured synthetic output reproduced the reset-query value; no real account, token or mail was involved.

Use Next's supported `logging: false` configuration to suppress raw request, fetch-warning and server-action argument output. The existing controlled backend request/audit records remain. `verify:framework-logging` calls the installed development request-handler wrapper with synthetic metadata and verifies no stdout, continued request handling, and a negative control reproducing raw URL/action output with default logging. It passes five checks; lint/types and frontend build verify configuration compatibility.

Framework URL trace attributes and unknown external proxy logs are separate from stdout and are addressed by the approved reset-fragment transport (SEC-26). No historical log/trace file or real capability was inspected or deleted. Reference: [Next logging configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging).
