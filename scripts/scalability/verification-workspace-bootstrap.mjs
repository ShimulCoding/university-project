import { requireVerificationWorkspace } from "./verification-workspace-boundary.mjs";

// Explicit --import preload. Normal helper imports remain side effect free.
await requireVerificationWorkspace({executionOnly:true});
