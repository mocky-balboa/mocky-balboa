# @mocky-balboa/cypress

## 2.0.1

### Patch Changes

- Updated dependencies [[782825f](https://github.com/mocky-balboa/mocky-balboa/commit/782825fb26761d0bd8de84c2a8112a390bfcd34a)]
  - [@mocky-balboa/client@2.0.1](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fclient%402.0.1)

## 2.0.0

### Major Changes

- [d326511](https://github.com/mocky-balboa/mocky-balboa/commit/d3265110ad1c72af09ef2f85cf543df2d5a5bad2): - Client side mocking now part of default behaviour. See [@mocky-balboa/client@2.0.0](https://github.com/mocky-balboa/mocky-balboa/tree/%40mocky-balboa/client%402.0.0) for changes there.
  - Ability to use custom commands – `import "@mocky-balboa/cypress/commands"` into your support file:
    ```typescript
    it("does something", () => {
      cy.mocky((mocky) => {
        mocky
          .route
          //...
          ();
      });
    });
    ```

  **BREAKING CHANGES**
  - Behaviour of mocking has changed from server only to both client and server side mocking

### Patch Changes

- Updated dependencies [[d326511](https://github.com/mocky-balboa/mocky-balboa/commit/d3265110ad1c72af09ef2f85cf543df2d5a5bad2)]
- Updated dependencies [[d326511](https://github.com/mocky-balboa/mocky-balboa/commit/d3265110ad1c72af09ef2f85cf543df2d5a5bad2)]
  - [@mocky-balboa/logger@1.0.7](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Flogger%401.0.7)
  - [@mocky-balboa/client@2.0.0](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fclient%402.0.0)

## 1.0.8

### Patch Changes

- [98b6b11](https://github.com/mocky-balboa/mocky-balboa/commit/98b6b113136331eeeda0f21990e62776763585f9): GitHub releases now part of release pipeline. This is the first release in GitHub releases for this package. See the packages CHANGELOG.md for packages full history.
- Updated dependencies [[98b6b11](https://github.com/mocky-balboa/mocky-balboa/commit/98b6b113136331eeeda0f21990e62776763585f9)]
  - [@mocky-balboa/client@1.1.4](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fclient%401.1.4)
  - [@mocky-balboa/logger@1.0.6](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Flogger%401.0.6)

## 1.0.7

### Patch Changes

- 563d332: Updated docs for server support list
- Updated dependencies [563d332]
  - @mocky-balboa/client@1.1.3
  - @mocky-balboa/logger@1.0.5

## 1.0.6

### Patch Changes

- @mocky-balboa/client@1.1.2

## 1.0.5

### Patch Changes

- 247b01c: Updated types output on build, added new quiet CLI option for Next.js integration, added new Vite package for vite plugin
- Updated dependencies [247b01c]
  - @mocky-balboa/client@1.1.1
  - @mocky-balboa/logger@1.0.4

## 1.0.4

### Patch Changes

- Updated dependencies [bd1a3ad]
  - @mocky-balboa/client@1.1.0

## 1.0.3

### Patch Changes

- @mocky-balboa/client@1.0.4

## 1.0.2

### Patch Changes

- c47c920: Updated package documentation
- Updated dependencies [c47c920]
  - @mocky-balboa/client@1.0.3
  - @mocky-balboa/logger@1.0.3

## 1.0.1

### Patch Changes

- be8d396: # Initial release

  This is the first official release of the mocky-balboa packages at launch.

- Updated dependencies [be8d396]
  - @mocky-balboa/client@1.0.2
  - @mocky-balboa/logger@1.0.2
