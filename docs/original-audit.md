# Original Metadata component audit

## Source and scope

This audit concerns the JSON tree labelled **Metadata** on sale detail pages. It does not concern KPI components named `MetadataCard`, `TransactionsMetadata`, or Next.js document metadata.

The source repository's checked-out `feat/custom-kpis` branch at `6a634d780fb19b38c99c79e2cf59ae761d9337ed` does not contain the JSON viewer. The implementation was located by inspecting the existing `feat/charge-metadata-card` branch at `9b4bc189b7d7b7f027900abc2b90b0b20bd9c0ee`, without changing branches or editing that repository. The component's last functional change is `f2f3cdd918588129ec06d3886dca7aecad08d8fe`. The audit refers to that branch snapshot; line references below are relative to that snapshot.

No applicable `AGENTS.md` was present in the source repository or the applicable parent directories. No source application, API, data, configuration, or credentials were modified. This document contains implementation findings and repository-relative paths; it contains no production payloads or internal business records.

## Framework and existing integration

The application uses React 19.2.4 and Next.js 16.2.2, with Tailwind CSS 4. The viewer is a React client component (`"use client"`), not a Solid component or a third-party JSON viewer.

The component is exported as `TransactionMetadataCard` from:

`apps/web/app/(onboard)/sales/[id]/_components/metadata-data.tsx`

Both sale detail routes reuse this implementation:

- Merchant route: `apps/web/app/(onboard)/sales/[id]/page.tsx:18` and `:240–244`.
- Admin route: `apps/web/app/admin/sales/[id]/page.tsx:18` and `:251–255`.

The pages obtain transaction detail through `TransactionsDataService.getTransactionById`, then pass the returned `transaction.metadata` to the viewer after a `Record<string, unknown> | null` assertion and null fallback. The viewer sits after the technical details card. The admin page imports the component from the merchant route directory, which couples a shared UI concern to a specific route's internal layout.

The viewer has no direct network or authentication logic. The API fetch is outside its boundary: `apps/web/fetches/transactions/get-transaction-by-id.ts:10–22` performs the authenticated detail request; `apps/web/services/transactions.ts:90–104` handles the application's detail cache. These concerns should remain in the host application, not in an independent inspector.

## Existing public API

The current API is:

```ts
interface OriginalMetadataProps {
  metadata: Record<string, unknown> | null;
  className?: string;
}
```

There are no public configuration props for depth, labels, theme, copying, search, selected path, row limits, string previews, callbacks, or controlled state. The component returns `null` for a null or empty root object (`metadata-data.tsx:23–32`). Root arrays and primitives are excluded by its declared API. Runtime data is trusted after the caller's assertion; there is no validation step.

## Current behavior

### Tree and expansion

The root is an implicit object: its entries are rendered directly without a root row or surrounding root braces (`:50–53`). A recursive `TreeNode` classifies any non-null object as a container and uses `Array.isArray` to distinguish arrays (`:60–71`). Objects use `Object.entries`; array items become string indices (`:89–91`).

Every mounted node owns `useState(level < 2)` (`:69`). The top-level entries use level zero, so nonempty containers at levels zero and one start open; containers at level two start closed. Empty containers are terminal rows. An open container shows its opening delimiter, child count, indented children, guide line, and closing delimiter. A closed container shows an ellipsis and a Portuguese item/key count (`:92–149`). Clicking its header toggles only that node.

Children mount only while their parent is open (`:140–147`). This limits initially mounted deep descendants, but it also discards their expansion state when the parent closes. Reopening a parent remounts each descendant with its default depth-based state.

### Value handling

| Input | Current display and behavior |
| --- | --- |
| Object | Enumerable own string properties, recursive rows and key count. |
| Array | Numeric string labels, recursive rows and item count. |
| String | Quoted text, full length, `break-all`; copied without JSON quotes. |
| Number | `String(value)` with a separate color. |
| Boolean | `true` / `false` with warning color. |
| `null` | Italic literal `null`. |
| `undefined` | Incorrectly displayed as `null`. |
| BigInt / function / symbol | Incorrectly displayed as `null`; copying may fail or produce no text. |
| Empty nested object / array | `{}` / `[]`; no toggle and no copy action. |
| Empty root object / null root | Entire card omitted. |
| URL / date string | Ordinary string with no special recognition or linking. |
| `Date`, `Map`, `Set` objects | Typically `{}` because they have no enumerable own entries. |

The primitive branch is at `:152–173`. React renders strings as text, so the original does not inject string values as HTML. However, displayed quotes do not imply that the text is escaped JSON syntax: embedded quotes, tabs, backslashes and line breaks have no explicit JSON escaping or whitespace-preserving presentation.

### Copy actions

The header offers full JSON copy with two-space formatting (`:41–46`). Nonempty containers offer subtree JSON copy (`:134–138`). Primitive rows offer value copy (`:80–84`, `:175–177`). Copying does not provide a path operation.

`copyText` first uses `navigator.clipboard.writeText`. On failure, it creates a hidden textarea and calls `document.execCommand("copy")` (`:179–191`). Each copy control shows a check icon for 1.5 seconds after the helper resolves (`:194–229`). Primitive and subtree copy controls are visually hidden until the row is hovered; the header control remains visible.

## Dependencies, styling and monorepo coupling

The component imports React `useState`; local `Card`, `CardAction`, `CardContent`, `CardHeader` and `CardTitle`; local `cn`; and four icons from `@tabler/icons-react` (`:3–17`). It does not directly import Next.js, the API client, Radix, a clipboard package, or a JSON-viewing package.

The local `cn` combines `clsx` and `tailwind-merge` (`apps/web/lib/utils.ts:1–5`). The local Card primitives also depend on `cn` and global branding variables (`apps/web/components/card.tsx:5–69`). Therefore a mechanical extraction would bring application aliases and styling assumptions even though its rendering logic is broadly reusable.

Its visual design uses Tailwind utilities and host theme tokens such as primary, foreground, muted, border, success and warning. The panel has a fixed `max-h-96`, both-axis overflow, a rounded border, a muted background, 13px text and line guides (`metadata-data.tsx:50`, `:75–79`, `:115–131`, `:141`, `:152–172`). There is no dedicated stylesheet or component-scoped CSS variable API.

The host's `font-mono` is mapped to the same proportional font token as `font-sans`, rather than to a true monospace stack (`apps/web/app/globals.css:13–16`). This weakens alignment and the code-inspector appearance.

The custom scrollbar is a global utility (`apps/web/app/globals.css:279–300`). Its color values use `hsl(var(--border))` and `hsl(var(--muted-foreground) / 0.4)`, while those variables contain hex values (`:89–94`, `:153–158`). Those substitutions are invalid CSS colors, so the intended scrollbar thumb colors cannot be relied on. A reusable implementation should consume color variables directly and scope its styles.

## Confirmed defects and limitations

### Correctness

1. **Unsupported primitives are conflated with null.** The primitive renderer falls through to `null` for every non-string, non-number, non-boolean value (`metadata-data.tsx:152–173`). An inspector accepting arbitrary JavaScript data must distinguish `undefined` and explicitly handle unsupported values.
2. **Serialization is not safe for the accepted nested `unknown` values.** `JSON.stringify` throws for BigInt and circular references, returns `undefined` for standalone undefined/function/symbol, and replaces non-finite numbers with null. The copy getters are unguarded (`:43`, `:135`, `:175–177`, `:205–209`). Thus some values display differently from their copied representation, and some copy clicks reject.
3. **Objects other than JSON records are misrepresented.** Date, Map and Set values can appear as empty objects; enumerable getters are invoked by `Object.entries` and can throw during rendering (`:89–91`). There is no getter-error isolation, circular-reference marker, depth ceiling or node budget.
4. **Sparse arrays have inaccurate child counts.** Array `.map` preserves holes, so `childEntries.length` includes absent entries while the render `.map` omits those slots (`:89–95`, `:142–144`).
5. **Copy feedback can falsely report success.** The fallback ignores the boolean result of `execCommand` and always resolves if it does not throw (`:179–191`). The button then sets its success state unconditionally. The temporary textarea also has no `finally` cleanup if the fallback throws.
6. **Copy timers are not cleaned up.** A timeout is created on each click without cancellation or unmount cleanup (`:203–209`). Repeated clicks can cause an older timer to clear newer feedback early.
7. **Nested expansion state is lost.** Closing a parent unmounts its children; their individual open/closed choices do not survive reopening (`:69`, `:140–147`). Prop replacement retaining the same keyed rows can conversely preserve local node state for different data.
8. **Empty root payloads have no explicit state.** The API hides the entire card for `{}` or null, so a generic consumer cannot distinguish empty data from an absent inspector (`:30–32`).

The serialization, Date and sparse-array findings were additionally checked using small synthetic JavaScript values, without reading or executing real transaction payloads. These are language-level reproductions, not claims that production payloads contain those values.

### Accessibility and interaction

The expansion control is a native button, so it has basic keyboard activation. It lacks `aria-expanded` and any association with the controlled child region (`:116–133`). The output has no declared tree semantics or tree keyboard navigation. Copy buttons have labels and titles (`:213–217`), but row opacity depends only on hover (`:83`, `:137`); a keyboard or touch user can have difficulty discovering them. The changing icon/title is not a live status message, and there is no accessible failure announcement.

There is no global expand/collapse, configurable initial depth, search, ancestor-preserving search filter, match highlight, JSON path selection, copy path, breadcrumbs, or result navigation. Keys containing dots, brackets or quotes have no canonical path representation. Long strings render in full and can dominate row height; long keys are truncated in container headers. Deep indentation consumes horizontal space indefinitely. Empty containers lack the operations available to other values.

### Performance

The scroll panel limits visible height, not the number of mounted DOM rows. A wide root object renders all root entries. A top-level large array is initially expanded and mounts every item; arrays nested at the second open level do the same. There is no pagination, virtualization, progressive disclosure, maximum visible-row budget, or preprocessing budget (`:51–53`, `:69`, `:89–91`, `:140–147`).

Each mounted container computes its full child entry list on render, including while collapsed. A large array's child mapping allocates entries before the collapsed/open check. Copying a large subtree synchronously serializes the entire value on the main thread. Very long strings are inserted in full. Very deep manually expanded structures have no enforced recursion limit. These are concrete unbounded paths in the implementation; this audit did not benchmark the original application's runtime and does not invent throughput figures.

## Extraction requirements derived from this audit

An independent React library should preserve the useful tree, guide lines, type colors and per-value/subtree copying, while replacing route/Card/Tailwind/icon coupling with a small public component and scoped CSS. It should accept `unknown` at its public boundary, normalize or classify values without `any`, and document how extended JavaScript values differ from JSON.

The new implementation needs stable path-based expansion, explicit root and empty states, configurable initial depth, accessible toggle and copy feedback, search with ancestor context and highlighted matches, canonical copyable paths, optional safe links and date recognition, and compact previews for long strings. Large data should have explicit traversal and rendering bounds; global expansion must respect those bounds. Clipboard operations must propagate actual failure, and timer cleanup must be deterministic.

Regression coverage should focus on semantic distinctions (null versus undefined, empty values, arrays, unusual keys, date objects), nested expansion, search/path navigation, copying success/failure, cycles/BigInt/getters, and bounded large/deep inputs. Synthetic datasets are sufficient for the playground and tests; no real transaction metadata is required.

## Evidence index

All paths below are relative to the original repository and refer to `feat/charge-metadata-card` at the snapshot stated above.

| Source | What it establishes |
| --- | --- |
| `apps/web/app/(onboard)/sales/[id]/_components/metadata-data.tsx:1–57` | Client boundary, dependencies, API, root behavior and header copy. |
| Same file `:60–149` | Recursive entries, depth defaults, expansion lifecycle, empty values and subtree copying. |
| Same file `:152–177` | Primitive handling and primitive serialization. |
| Same file `:179–230` | Clipboard fallback, copy state, timer and labels. |
| `apps/web/app/(onboard)/sales/[id]/page.tsx:240–244` | Merchant detail usage. |
| `apps/web/app/admin/sales/[id]/page.tsx:251–255` | Admin detail reuse. |
| `apps/web/components/card.tsx:5–69` | Host Card and branding/style coupling. |
| `apps/web/lib/utils.ts:1–5` | Class composition dependencies. |
| `apps/web/app/globals.css:13–16`, `:89–94`, `:153–158`, `:279–300` | Font mapping, token formats and invalid scrollbar colors. |
| `apps/web/package.json` | React, Next, Tailwind and third-party dependency versions. |
| `apps/web/fetches/transactions/get-transaction-by-id.ts:10–22` | Host-owned detail fetch. |
| `apps/web/services/transactions.ts:90–104` | Host-owned detail service and cache. |

No dedicated Metadata component tests were found in this branch snapshot. Source inspection and synthetic semantic probes establish this audit's findings; visual and functional verification of the independent implementation is recorded separately.
