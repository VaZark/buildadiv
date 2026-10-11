# 06 · Roadmap and open questions

**Contents:** [Versions](#versions) · [Linting (v1.1)](#linting-v11) · [MCP (v2)](#mcp-v2) · [Open questions](#open-questions)

---

## Versions

| Version | Scope |
|---|---|
| **v1** | `shared`: filters, pipeline parser, path resolution, slot rules. Part 1: the runtime library (templates, bindings, slots, `<render-template>`, providers and mutations, tags, cache). Part 2: the builder (HTML parsing, component tags, `{{ }}`, build) and the browser editor |
| **v1.1** | The template/action linter. Not a blocker for 1.0 |
| **v2+** | An MCP server exposing the project to external agents. Opt-in |

Don't build v1.1 or v2 features while v1 is in progress.

## Linting (v1.1)

Actions don't declare a schema in our own format. Linting has two halves:

1. **Template side (ours).** Scan every template and collect every path it reads: bindings, attribute bindings, conditionals, lists. That's its set of required fields, from which we **generate a type** (e.g. TypeScript) per template.
2. **Action side (TypeScript's).** The developer types what the action returns, `{ response, context }`, with TypeScript or a schema library that produces TypeScript types. TypeScript does the comparison.

**Lint hooks**, loaded only while linting:

1. Generate the shape of every template.
2. For each `<render-template>` with `load-from-action` or `subscribe-to-action`, take the action's return type. It may be a union (`void`, a success type, a failure type, …).
3. Check that **every template the element registers** (`on-pending`, `on-success`, `on-no-content`, `on-error`) is satisfied by **at least one** of those types.

- The `context` function itself isn't tested; only the `{ response, context }` return types are.
- Slots aren't type-checked: they hold the user's markup, not data.
- Unregistered filters are flagged too.
- This is engineering and demo tooling, not runtime. The required fields also let the editor generate fixtures.

## MCP (v2)

There is **no built-in agent**. The project exposes its capabilities over MCP, and any external agent does the work. Everything here is **opt-in**.

**Planned uses:**

- **Generate components from data:** pass real or fake data, let the agent parse its shape, and propose components, fixtures and actions.
- **Port React/Vue → vanilla:** agents read framework code and produce component folders in this format.
- **Suggest components from existing HTML:** agents look at parsed pages (e.g. repeated markup) and propose components to extract.

**Porting rules:**

- Input: a framework component. Output: a component folder in this format.
- Preserve the interface: **props that carry data become bindings**; **`children` and render props that carry markup become slots**; events stay events.
- Move data fetching and loading/error states into an `api/` provider or mutation.
- Add a `PORT_REPORT.md` listing what ported cleanly, what was restructured, which dependencies were replaced (and with what), and what needs human review.
- Never add a framework dependency to make a port work.

## Open questions

| Question | Area |
|---|---|
| Importing React/Vue components into the editor: v1, or v2 alongside MCP porting? What does "comparison" show: original vs port, variants side by side, or both? | Editor |
| How generated template types are exposed to TypeScript | Linting (v1.1) |
| Where the MCP server runs, given the editor is browser-only with no required local server: a remote endpoint, or an optional local bridge? | MCP (v2) |
| How static values reach a component tag at build time (e.g. a product card on a static page): attributes on the tag read with `{{ }}`, or slots only? | Builder |
