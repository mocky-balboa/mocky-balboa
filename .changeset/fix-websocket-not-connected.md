---
"@mocky-balboa/client": patch
"@mocky-balboa/playwright": patch
---

Fix `Error: WebSocket is not connected` raised when the client attempted to send messages before the underlying WebSocket connection had been established.
