---
"@mocky-balboa/server": patch
---

Forward `mockServerOptions` from `startServer` through to the mock server so the configured client-response timeout is applied. Previously the option was accepted and silently discarded, which also left the `-t, --timeout` CLI flag with no effect.
