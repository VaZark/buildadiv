# 08 · Code map and validation

The specs describe behavior; this page locates its implementation and verification.
Start with contracts, follow the request or rendering flow, then read the corresponding
tests. Generated `dist/` files are build output; review the TypeScript source.

## Package boundaries

| Package (npm name)                      | Responsibility                                                                               | Allowed package dependencies   |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------ |
| `shared` (`@buildadiv/shared`, private) | Paths, pipelines, filters, slots, sanitization and template references                       | None                           |
| `runtime` (`@buildadiv/query-template`) | Client-side rendering and HTTP data lifecycle                                                | `shared`                       |
| `builder` (`@buildadiv/builder`)        | Static HTML parsing, components (folders, CSS scoping), page bundles and the Node site build | `shared`                       |
| `editor` (planned)                      | Browser editor                                                                               | `shared`, `runtime`, `builder` |

`npm run validate:architecture` checks these boundaries, native `.js` specifiers
(relative inside a package, by package name across packages, with the dependency
declared in `package.json`), Node-only adapter isolation, and acyclic value imports. Type-only references may cross domains.
It also prevents explicit `any` and disabled type checks in library source. This
validates code organization; it does not implement the future template linter.

## Runtime

Documented public modules (`index.ts`, `action.ts`, `cache.ts`, `formats.ts`,
`stores.ts`, `filters.ts`, `types.ts`) remain at the package root. Browser imports
use the emitted `.js` paths. Internal modules import domain contracts directly.

| Folder / module                                          | Review for                                                | Validation                                                              |
| -------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `contracts/http.ts`                                      | Methods and request formats                               | `tests/contracts/actions.ts`                                            |
| `contracts/actions.ts`                                   | Role interfaces, forbidden fields and callable APIs       | `tests/contracts/actions.ts`                                            |
| `contracts/results.ts`                                   | Template state and result shape                           | Runtime unit `actions.test.ts`                                          |
| `contracts/queries.ts`, `storage.ts`, `configuration.ts` | Cache, persistence and registration contracts             | Type check; runtime unit tests                                          |
| `actions/factory.ts`, `methods.ts`                       | Helper construction and JavaScript boundary validation    | Runtime unit `actions.test.ts`; compile-time contracts                  |
| `actions/request.ts`, `results.ts`                       | Fetch/decoding, state events and failures                 | Runtime unit `actions.test.ts`; browser `runtime/actions.spec.ts`       |
| `data/entries.ts`, `queries.ts`, `lifetime.ts`           | Shared queries, mounted references and timers             | Runtime unit `queries.test.ts`                                          |
| `data/policies.ts`                                       | HTTP freshness, argument keys and exported merge defaults | Runtime unit `policies.test.ts`                                         |
| `data/persistence.ts`, root `stores.ts`                  | Restore/save and browser storage adapters                 | Runtime unit `persistence.test.ts`; browser `runtime/storage.spec.ts`   |
| `data/pagination.ts`                                     | Page aggregation and tail cursor                          | Runtime unit `pagination.test.ts`; browser `runtime/pagination.spec.ts` |
| `data/tags.ts`, `keys.ts`                                | Invalidation, reconciliation and id matching              | Runtime unit `tags.test.ts`; browser action/rendering tests             |
| `dom/bindings.ts`, `element.ts`                          | Keyed nodes, bindings, slots and state templates          | Browser `runtime/rendering.spec.ts`                                     |
| `dom/triggers.ts`, `configuration/settings.ts`           | Declarative triggers and named module registration        | Browser `runtime/actions.spec.ts`                                       |
| `standalone.ts`                                          | Single-file distribution entry (`vp pack`)                | Browser `builder/site.spec.ts` (the page loads only the packed file)    |

Read the data path in this order:

1. `actions/factory.ts` applies the typed role and defaults.
2. `data/queries.ts` deduplicates loads and restores cached state.
3. `actions/request.ts` fetches, decodes, and publishes a result.
4. `data/tags.ts` applies successful mutation effects.
5. `dom/element.ts` maps states to templates; `dom/bindings.ts` updates native nodes.

Request execution, timers and tag effects receive the typed `QueryRefresher`
callback. They do not import the query coordinator, so the value-import graph
stays acyclic even though requests can cause mounted queries to refetch.

## Builder

| Module                        | Responsibility                                          | Validation                                                  |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| `contracts.ts`                | Expansion and parse/serialize adapters                  | Type check                                                  |
| `html.ts`                     | Native document parsing/serialization                   | Builder browser tests                                       |
| `definitions.ts`              | Template lookup, names and duplicate detection          | `builder/components.spec.ts`                                |
| `interpolation.ts`            | Shared pipeline evaluation into plain strings           | `builder/interpolation.spec.ts`                             |
| `expansion.ts`                | In-place replacement, scope ownership, slots and cycles | `builder/components.spec.ts`                                |
| `pruning.ts`                  | Dropping definitions the runtime no longer renders      | `builder/components.spec.ts`                                |
| `loading.ts`                  | Finding and loading the component files a page uses     | `builder/files.spec.ts`                                     |
| `usage.ts`                    | Merging page component usage for the global build       | `builder/files.spec.ts`                                     |
| `bundling.ts`                 | Page bundle names, bundler call and bundle links        | `builder/files.spec.ts`                                     |
| `components.ts`               | Component folder convention over HTTP                   | Unit `builder/components.test.ts`                           |
| `css.ts`                      | Scoping plain component CSS to `[data-c]`               | Unit `builder/css.test.ts`                                  |
| `scoping.ts`                  | Writing `data-c` into shipped runtime templates         | `builder/files.spec.ts`, `builder/interpolation.spec.ts`    |
| `node/vite.ts`                | Node-only Vite+ bundler: scopes, bundles, minifies      | Unit `builder/vite.test.ts`                                 |
| `node/folder.ts`              | Component folders on disk                               | Unit `builder/site.test.ts`                                 |
| `node/dom.ts`                 | jsdom parsing for Node builds                           | Unit `builder/site.test.ts`                                 |
| `node/site.ts`, `node/cli.ts` | Whole-site build and the `buildadiv build` CLI          | Unit `builder/site.test.ts`; browser `builder/site.spec.ts` |
| `build.ts`, `index.ts`        | String compilation and the public facade                | `builder/example.spec.ts`                                   |

The builder composes these stages and imports only shared utilities. Runtime
blocks are preserved; the first stage does not bundle assets or provide an editor.

## Tests, examples and tooling

- `tests/unit/shared/`: paths, the pipeline parser (arguments, order, rejected expressions,
  registry isolation) and every filter (defaults, locales, missing values, failures).
- `tests/browser/runtime/filters.spec.ts`: filters in text and attribute bindings, sanitization
  after filtering, unregistered filters, and identical results in `<use-template>` and `{{ }}`.
- `tests/unit/builder/`: component folders, CSS scoping, the Vite+ bundler, `buildSite` and the CLI.
- `tests/unit/runtime/`: contracts, request outcomes, queries, tags, policies,
  formats, persistence and pagination.
- `tests/contracts/`: compile-only positive/negative TypeScript API checks.
- `tests/browser/runtime/` and `tests/browser/builder/`: emitted modules on vanilla pages.
- `tests/support/`: shared fixture helpers, browser globals and the demonstration HTTP server.
  `tests/support/components/` is a fixture component folder used by runtime and builder tests.
- `examples/site/`: a site built by the CLI (`npm run build:site`) into `dist/examples/site-output/`;
  its pages load only the standalone runtime file.
- `examples/vanilla/`: live runtime shop; all HTTP actions stay in `api/`.
- `examples/runtime/`: the `<use-template>` gallery (states, lists, nested templates,
  subscribe vs load-once, pagination, direct `.data`) on the standalone runtime file;
  `tests/browser/runtime/gallery.spec.ts` walks every section.
- `examples/builder/`: static composition source and sandboxed output preview.
- `examples/playground/`: manual scenarios for runtime behaviors; `tests/browser/runtime/playground.spec.ts`
  walks the same steps so the page's instructions stay accurate.
- `scripts/build.ts`: copies HTML/CSS next to compiled modules.
- `scripts/validate-architecture.ts`: validates the documented import graph, including that
  only `packages/*/node/` adapters import Node built-ins or `vite-plus`.
- `vite.config.ts`: Oxfmt and Oxlint settings for `vp fmt` / `vp lint`.

Browser cases run on port 4174 (`TEST_PORT`), so `npm run serve-examples` can keep 4173 (`PORT`).
They run with one worker because they share the demo API's mutable state.
Each runtime case resets that state. This makes request-count assertions deterministic.

## Commands

| Command                         | Checks / output                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run typecheck`             | `tsc -b` (TypeScript 7): every package, then examples, fixtures and contracts          |
| `npm test`                      | Clean compilation and unit tests                                                       |
| `npm run test:browser`          | Clean compilation and real Chromium integration tests                                  |
| `npm run validate:architecture` | Clean compilation and package/import rules                                             |
| `npm run lint`                  | Oxlint with type-aware rules and type checking; warnings fail                          |
| `npm run format`                | Oxfmt rewrite of maintained sources                                                    |
| `npm run format:check`          | Consistent formatting without edits                                                    |
| `npm run check`                 | One clean build, architecture checks, format, lint and both test layers                |
| `npm run build:lib`             | `vp pack` each published package into its `lib/`; copy the runtime file to `dist/lib/` |
| `npm run serve-examples`        | Compile and serve both example websites                                                |

Formatting and lint settings live in `vite.config.ts` and run through Vite+ (`vp fmt`,
`vp lint`). `vp env` selects the Node.js and npm versions pinned in `devEngines`.
Each package compiles into its own `dist/` (project references); `npm run build` mirrors
those into the repository's `dist/packages/` for the examples and tests, packs the published
`lib/` outputs, and builds the example site with the packed CLI.

Install dependencies with `vp install` (or `npm install`, which also links the workspace
packages) and the browser with
`npx playwright install chromium`. Builds replace only generated `dist/` output,
preventing moved or deleted modules from surviving as stale JavaScript.
