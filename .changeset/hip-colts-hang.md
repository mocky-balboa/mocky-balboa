---
"@mocky-balboa/cypress": major
---

- Client side mocking now part of default behaviour. See [@mocky-balboa/client@2.0.0](https://github.com/mocky-balboa/mocky-balboa/tree/%40mocky-balboa/client%402.0.0) for changes there.
- Ability to use custom commands – `import "@mocky-balboa/cypress/commands"` into your support file:
   ```typescript
   it("does something", () => {
     cy.mocky((mocky) => {
       mocky.route(
         //...
       );
     });
   });
   ```

**BREAKING CHANGES**

- Behaviour of mocking has changed from server only to both client and server side mocking
