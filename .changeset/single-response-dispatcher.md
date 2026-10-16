---
"@mocky-balboa/server": patch
---

Route responses from the client to their pending request through a single message listener per connection. Previously every in-flight request registered its own listener, so each response was parsed once per pending request, which slowed response handling to a crawl under many concurrent requests.
