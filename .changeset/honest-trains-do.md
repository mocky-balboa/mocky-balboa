---
"@mocky-balboa/client": major
---

Support injecting handlers for client side route interception. __API not changed__, but behaviour has changed from defaulting from only mocking on the server to mocking on both the server and the client.

Added the ability to scope mocks to:

- `server-only`
- `client-only`
- `both` (default behaviour)

**BREAKING CHANGES**

- Behaviour of mocking has changed from server only to both client and server side mocking
