---
"@mocky-balboa/playwright": major
---

- Client side mocking now part of default behaviour. See [@mocky-balboa/client@2.0.0](https://github.com/mocky-balboa/mocky-balboa/tree/%40mocky-balboa/client%402.0.0) for changes there.
- Ability to use `import test from "@mocky-balboa/playwright/test"` to directly access client instances on test object:
   ```typescript
   import test from "@mocky-balboa/playwright/test";

   test("my test", ({ mocky }) => {
     mocky.route(
       //...
     );
   });
   ```

**BREAKING CHANGES**

- Behaviour of mocking has changed from server only to both client and server side mocking
