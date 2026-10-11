# Contributing

Read [AGENTS.md](AGENTS.md) first, then the relevant specification in `docs/`.
[The code map](docs/08-code-map.md) connects each responsibility to its implementation,
tests and validation commands. The runtime and initial component expander are
implemented; the remaining builder pipeline and editor are planned.

## Organize changes by responsibility

- Keep the four-package dependency rules: `shared` is independent; `runtime` and
  `builder` depend on shared utilities and never on each other.
- Preserve documented package-root imports. Public entry points compose APIs;
  implementation code imports its owning domain directly.
- Use nested folders for coherent responsibilities, not arbitrary file-size limits.
  Keep contracts, HTTP actions, cached data, DOM rendering and settings distinct.
- Keep value imports acyclic. Pass a typed callback where lower-level code must
  invoke a higher-level coordinator. Cross-domain type-only imports are allowed.
- Package code is browser-compatible. Node-only adapters live in
  `packages/<package>/node/`; only they may import `node:*` built-ins and `vite-plus`,
  and no browser module may import them. Core code receives them as functions
  (for example a `Bundler`), so it stays usable in the editor.
- Share filters, pipelines, path resolution, slot rules and sanitization rather
  than copying logic into runtime or builder modules.
- Keep example HTTP actions in `api/`; component behavior never fetches data.

## TypeScript and API design

- Use strict TypeScript for libraries, examples, tests and tooling. Use `unknown`
  at untrusted boundaries, then narrow it. Do not use `any`, `@ts-ignore` or
  `@ts-nocheck` in library code.
- Encode roles with interfaces, discriminated unions and forbidden `never` fields.
  Reject incompatible options passed through variables as well as object literals.
  Do not keep parallel string arrays listing legal options.
- Preserve per-action argument, response and role types in public return values.
  Erase heterogeneous cache generics only at the documented internal boundary.
- Use `import type` / `export type` for erased contracts. Keep relative `.js`
  specifiers in `.ts` source so compiled pages use native browser imports.
- Customizable behaviors are functions with exported defaults. HTML filter names
  are the sole explicitly registered name-based transform mechanism.
- Keep boundary validation for plain JavaScript consumers separate from typed
  execution. Expected compile-time failures use `@ts-expect-error` in contract
  tests with a reason; do not use assertions to make invalid calls look valid.

## Rendering and data rules

- Render native DOM nodes. Do not add a virtual DOM, shadow DOM, a framework runtime,
  server rendering or backend template-engine integration.
- Bind data through text or sanitized attributes; never inject it as HTML.
  Slots carry author-written markup, and every slot/binding has preview content.
- Limit template logic to path truthiness and single-value filters. Derived logic
  belongs in an action's context function.
- Preserve keyed DOM ownership, caller scope for supplied slots, and runtime
  template/host preservation during static expansion.
- Keep action names globally unique. Only subscribing regions count as mounted
  queries; unmounted cache data must not trigger refetches.

## Readability and comments

- Use names that state the domain and outcome. Keep each function's responsibility
  clear and avoid dense chains of mutations or several statements on one line.
- Function comments explain why the function exists and its expected behavior:
  inputs/results, ownership, preserved state, or relevant failure behavior.
  Explain non-obvious scope, lifecycle and generic-erasure boundaries.
- Prefer a short useful comment over narrating each implementation statement.
- Use `npm run format` (Oxfmt through Vite+) for maintained sources. Formatting uses
  single quotes and a 100-column print width; the spec docs `docs/00`–`07` keep
  hand-aligned tables and are excluded. Tool settings live in `vite.config.ts`.
- `npm run lint` runs Oxlint with type-aware rules and type checking and fails on
  warnings. Fix findings rather than silencing them; a deliberate exception goes in
  `vite.config.ts` or an `oxlint-disable-next-line` comment with the reason above it.
- Use `vp env` for the development runtime. `devEngines` in `package.json` pins Node.js
  and npm; change it with `vp env pin`, not by hand.

## Validation and review

1. Update the relevant spec and `docs/07-decisions.md` when behavior or conventions change.
2. Place tests by the behavior they validate: unit, compile-time contracts, or browser integration.
3. Test externally observable outcomes such as request counts, result states,
   retained DOM identity, slot scope or emitted HTML. Avoid tests that mirror code.
4. Run `npm run check` before handing off. Use individual commands in the code map
   while iterating; tests must exercise compiled modules on vanilla pages.
5. Report the behavior affected, relevant validation, and any remaining limitations.

Do not implement the v1.1 template linter or v2 MCP features while v1 is in progress.
Keep generated `dist/` output and test reports out of source control. A clean build
replaces generated output so obsolete modules cannot affect validation.
