# AGENTS.md

Start here. This file is the entry point for humans and coding agents. It says what the project is, where each topic is documented, and the rules to follow when working in this repo.

> **Status:** runtime and initial component expander implemented in TypeScript; remaining builder/editor work planned. The `docs/` folder is the working spec. When a decision changes, update the relevant doc **and** `docs/07-decisions.md`.

## The project in one paragraph

A small toolkit for building websites from plain HTML, CSS and JavaScript, in two parts. **Part 1** is a purely client-side **runtime library**: HTML templates with data bindings, a `<use-template>` element, and RTK-Query-style data fetching with tags and caching. It works on any page with no build step. **Part 2** is a **builder and visual editor**: it parses existing HTML files, composes them with Astro-style component tags, and builds static HTML that uses the runtime for its live regions. Logic both parts need, such as filters, lives in a shared package. The editor runs entirely in the browser and combines a component library viewer (like Storybook), a visual canvas (like GrapesJS) and a synced code/design view (like Dreamweaver).

## Where to read

Read in order the first time; afterwards, jump to the topic you need.

| Doc                                                                    | Read it for                                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`docs/00-overview.md`](docs/00-overview.md)                           | Goals, non-goals, principles, the two parts, glossary, and one end-to-end example              |
| [`docs/01-templates.md`](docs/01-templates.md)                         | Part 1: components, when to use bindings vs slots, filters, lists, conditionals, fixtures, CSS |
| [`docs/02-rendering-and-actions.md`](docs/02-rendering-and-actions.md) | Part 1: `<use-template>`, actions / queries / mutations, context, pagination, formats, events  |
| [`docs/03-data-layer.md`](docs/03-data-layer.md)                       | Part 1: tags, cache, freshness, persistence, invalidation, reconciliation                      |
| [`docs/04-builder-and-editor.md`](docs/04-builder-and-editor.md)       | Part 2: parsing HTML, component tags, `{{ }}`, build output, the editor, package layout        |
| [`docs/05-reference.md`](docs/05-reference.md)                         | Every attribute, option, default and event on one page                                         |
| [`docs/06-roadmap.md`](docs/06-roadmap.md)                             | v1 / v1.1 / v2 scope, linting, MCP, open questions                                             |
| [`docs/07-decisions.md`](docs/07-decisions.md)                         | What was decided, and what each decision replaced                                              |
| [`docs/08-code-map.md`](docs/08-code-map.md)                           | Source responsibilities, dependency flow and validation commands                               |

## Rules for coding agents

Use [CONTRIBUTING.md](CONTRIBUTING.md) for the full coding/review guidelines and
[the code map](docs/08-code-map.md) to locate implementations and tests.

**Architecture**

- Keep documented public imports as small entry points. Group internals in semantic nested folders; avoid mixed-responsibility modules.
- Keep value imports acyclic; inject typed coordinator callbacks where needed. Use type-only imports for contracts.
- Package code stays browser-compatible. Node-only adapters (e.g. the Vite+ bundler) live in `packages/<package>/node/` and are passed into core code as functions.
- Four workspace packages ([04](docs/04-builder-and-editor.md#packages)): `shared` (`@buildadiv/shared`, private), `runtime` (`@buildadiv/query-template`), `builder` (`@buildadiv/builder`), `editor` (planned). Each has its own `package.json`, tsconfig and build.
- Cross-package imports use the package name (`@buildadiv/shared/path.js`) and a declared dependency; never `../` into another package. Published packages inline `shared`.
- `shared` imports from no other package. `runtime` and `builder` import from `shared` but **never from each other**. Part 1 stands alone.
- Logic needed both at build time and in the browser (filters, the filter-pipeline parser, path resolution, slot filling) goes in `shared`, written once.
- Don't add server rendering or server template-engine integration. The runtime is client-side; only our own build pre-renders, through component tags.
- Don't introduce shadow DOM, a virtual DOM or a framework runtime. Nothing framework-based ships in build output.
- Customizable behavior is a **function with an exported default**, never a string looked up by name. (Filter names in HTML are the one exception: they're registered explicitly.)

**Templates**

- **Data goes in `data-bind`; markup from the component's user goes in slots.** Never use a slot for a value that comes from data.
- Every slot and binding must have preview content.
- Template logic is limited to `data-if` / `data-if-not` truthiness checks and single-value filters. Anything more goes in the action's `context` function.
- Bindings write text or sanitized attributes only. Never `innerHTML`.

**Data**

- Component JS never fetches. All fetching and mutation lives in `api/` as queries and mutations.
- Action names are unique across the project (events are named after them).

**Process**

- Write source, examples, and tests in strict TypeScript. Emit native `.js` ES modules with `npm run build`; keep `.js` in import paths so compiled vanilla pages work without a bundler.
- Encode disjoint API roles with interfaces, forbidden `never` fields, literal method types, and discriminated unions; do not maintain string arrays of legal option names.
- Use `unknown` at untrusted boundaries and narrow it; do not use `any` or suppress type checking in library code.
- Function comments explain why the function exists and its expected behavior, especially ownership, lifecycle and failure rules.
- Run `npm run check` before handing off; keep unit, compile-time contract and browser validation in their matching test folders.
- Format maintained sources with `npm run format` (Oxfmt) and keep `npm run lint` (Oxlint) warning-free; keep generated `dist/` output out of source control.
- Use Vite+ (`vp`) for the development environment; Node.js and npm are pinned in `devEngines`.
- Generated or hand-written code must stay readable enough to maintain by hand.
- If a task needs a new convention, propose it in the docs before implementing it.
- Don't build v1.1 or v2 features (linter, MCP) while v1 is in progress.
