# @mocky-balboa/client

## 2.0.0

### Major Changes

- [d326511](https://github.com/mocky-balboa/mocky-balboa/commit/d3265110ad1c72af09ef2f85cf543df2d5a5bad2): Support injecting handlers for client side route interception. **API not changed**, but behaviour has changed from defaulting from only mocking on the server to mocking on both the server and the client.

  Added the ability to scope mocks to:
  - `server-only`
  - `client-only`
  - `both` (default behaviour)

  **BREAKING CHANGES**
  - Behaviour of mocking has changed from server only to both client and server side mocking

### Patch Changes

- Updated dependencies [[d326511](https://github.com/mocky-balboa/mocky-balboa/commit/d3265110ad1c72af09ef2f85cf543df2d5a5bad2)]
  - [@mocky-balboa/logger@1.0.7](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Flogger%401.0.7)
  - [@mocky-balboa/shared-config@1.0.8](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fshared-config%401.0.8)
  - [@mocky-balboa/websocket-messages@1.0.8](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fwebsocket-messages%401.0.8)

## 1.1.4

### Patch Changes

- [98b6b11](https://github.com/mocky-balboa/mocky-balboa/commit/98b6b113136331eeeda0f21990e62776763585f9): GitHub releases now part of release pipeline. This is the first release in GitHub releases for this package. See the packages CHANGELOG.md for packages full history.
- Updated dependencies [[98b6b11](https://github.com/mocky-balboa/mocky-balboa/commit/98b6b113136331eeeda0f21990e62776763585f9)]
  - [@mocky-balboa/logger@1.0.6](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Flogger%401.0.6)
  - [@mocky-balboa/shared-config@1.0.7](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fshared-config%401.0.7)
  - [@mocky-balboa/websocket-messages@1.0.7](https://github.com/mocky-balboa/mocky-balboa/releases/tag/%40mocky-balboa%2Fwebsocket-messages%401.0.7)

## 1.1.3

### Patch Changes

- 563d332: Updated docs for server support list
- Updated dependencies [563d332]
  - @mocky-balboa/logger@1.0.5
  - @mocky-balboa/shared-config@1.0.6
  - @mocky-balboa/websocket-messages@1.0.6

## 1.1.2

### Patch Changes

- Updated dependencies [e703541]
  - @mocky-balboa/shared-config@1.0.5

## 1.1.1

### Patch Changes

- 247b01c: Updated types output on build, added new quiet CLI option for Next.js integration, added new Vite package for vite plugin
- Updated dependencies [247b01c]
  - @mocky-balboa/websocket-messages@1.0.5
  - @mocky-balboa/shared-config@1.0.4
  - @mocky-balboa/logger@1.0.4

## 1.1.0

### Minor Changes

- bd1a3ad: Added support for reading the request directly on the route via route.request

## 1.0.4

### Patch Changes

- Updated dependencies [1d9392b]
  - @mocky-balboa/websocket-messages@1.0.4

## 1.0.3

### Patch Changes

- c47c920: Updated package documentation
- Updated dependencies [c47c920]
  - @mocky-balboa/logger@1.0.3
  - @mocky-balboa/shared-config@1.0.3
  - @mocky-balboa/websocket-messages@1.0.3

## 1.0.2

### Patch Changes

- be8d396: # Initial release

  This is the first official release of the mocky-balboa packages at launch.

- Updated dependencies [be8d396]
  - @mocky-balboa/logger@1.0.2
  - @mocky-balboa/shared-config@1.0.2
  - @mocky-balboa/websocket-messages@1.0.2
