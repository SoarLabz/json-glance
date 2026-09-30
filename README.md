# json-glance

A focused React inspector for JSON and structured metadata. Explore nested data, search values, jump to a path and copy what you need in a compact interface built for dashboards, backoffices and developer tools.

React is the only runtime dependency. The package includes strict TypeScript declarations, ESM exports and a separate, scoped stylesheet. No Tailwind, icon package or application framework is required.

![json-glance playground showing a transaction metadata inspector and configuration controls](https://raw.githubusercontent.com/SoarLabz/json-glance/main/docs/playground.png)

## Installation

The initial `1.0.0` release is prepared for publication. The npm name was available when checked on September 30, 2026; the package has not been published yet. After the first release:

```sh
npm install json-glance
```

Use React **18.2 or later in the 18.x line, or React 19.x**. The package is ESM only. Import its CSS once in your application entry point or stylesheet entry.

## Quick start

```tsx
import { JsonGlance } from 'json-glance';
import 'json-glance/styles.css';

const metadata = {
  reference: 'demo-001',
  amount: 125.5,
  paid: true,
  customer: { name: 'Ada', preferences: null },
  items: [{ name: 'Notebook', quantity: 2 }],
};

export function MetadataPanel() {
  return (
    <JsonGlance
      data={metadata}
      rootLabel="metadata"
      defaultExpandedDepth={2}
      searchable
      copyable
    />
  );
}
```

`data` accepts `unknown`. Objects, arrays and primitive roots all work, including explicit `null`, `undefined`, `{}` and `[]`. Strings are inspected as strings; the component never parses a string as JSON.

## Exploring data

- Toggle individual containers or use the global expand/collapse controls. Descendant choices survive a parent collapse.
- Search keys, values or paths. Matches are highlighted and their ancestors are revealed, including matches inside collapsed branches and long strings.
- Select a row to see its canonical path, then copy the path or inspect the selected value in **Details**.
- Long strings have a compact preview and a **Full value** action. Full strings remain available for search and copying.
- Valid HTTP/HTTPS strings become links opened in a separate tab with `noopener noreferrer`. URLs with credentials or control characters remain text. Valid ISO calendar dates, UTC timestamps and `Date` objects receive a date type label.
- Large expanded trees use fixed-height virtualization to keep the mounted row count small.

This is a read-only inspector. It does not edit data, fetch remote resources or contain transaction-specific rules.

### Tree-only view

Use `minimal` to embed just the data tree in your own card or detail panel:

```tsx
<JsonGlance data={metadata} rootLabel="metadata" minimal />
```

The preset hides the toolbar, selected-path footer and **Go to path** form. Individual expansion, keyboard navigation, row copying and type labels remain available. Long strings still open their full value when requested; primitive rows also open Details with Enter or Space. An opened detail panel includes its own close action when the footer is hidden. Use `copyable={false}` or `showTypes={false}` to simplify the rows further.

Control each surrounding section independently when you need a different combination:

```tsx
<JsonGlance
  data={metadata}
  showToolbar={false}
  showFooter={false}
  showPathNavigation={false}
/>

// Restore only the toolbar while using the minimal preset.
<JsonGlance data={metadata} minimal showToolbar />
```

Each section defaults to `!minimal`; an explicit boolean overrides the preset. `searchable={false}` hides the search field within the toolbar. It leaves the toolbar's global expand, collapse and copy actions visible unless `showToolbar={false}` or `minimal` also hides that section.

### Keyboard controls

Tab into the tree, then use:

| Key | Action |
| --- | --- |
| Arrow Up / Arrow Down | Select the previous / next visible row. |
| Arrow Right | Expand a container, or move into its first visible child. |
| Arrow Left | Collapse a container, or move to its parent. |
| Home / End | Select the first / last visible row. |
| Enter / Space | Toggle a container; toggle Details for a primitive value. |

Toolbar, path and detail controls are native inputs and buttons. Selected paths reached through keyboard navigation or the path form are scrolled into view.

### Paths

Paths always begin at `$`, regardless of `rootLabel`. The **Go to path** field accepts the exact paths shown or copied by the inspector:

```text
$.customer.name
$.items[0].quantity
$["key.with.dots"]
$["key with spaces"]
```

This is exact indexed-path navigation, not a JSONPath query language: wildcards, recursive descent and filter expressions are not supported. A path beyond the indexing limits cannot be selected.

## API

### Component props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `unknown` | Required | The value to inspect. Use an immutable replacement when data changes. |
| `defaultExpandedDepth` | `number` | `2` | Open containers whose depth is less than this value. Root depth is `0`; `0` starts collapsed. Clamped to `0–65`. |
| `minimal` | `boolean` | `false` | Tree-only preset: hide the toolbar, footer and path form unless explicitly overridden. Row features remain available. |
| `showToolbar` | `boolean` | `!minimal` | Show the toolbar with optional search, global expansion and JSON copying. |
| `showFooter` | `boolean` | `!minimal` | Show the selected path, counts, Details action and optional path copying. |
| `showPathNavigation` | `boolean` | `!minimal` | Show the Go to path form. |
| `searchable` | `boolean` | `true` | Show key, value and path search when the toolbar is visible. |
| `copyable` | `boolean` | `true` | Enable JSON, selected value and selected path copying. |
| `showTypes` | `boolean` | `true` | Show type labels alongside syntax colors. |
| `rootLabel` | `string` | `'root'` | Display label of the root row. |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color scheme; auto follows the operating system preference. |
| `maxHeight` | `number` | `420` | Maximum tree viewport height in pixels; minimum `96`. |
| `stringLimit` | `number` | `160` | Preview character limit; minimum `16`. Full values remain in Details. |
| `maxNodes` | `number` | `50000` | Maximum indexed nodes, including the root. A positive safe integer. |
| `maxDepth` | `number` | `64` | Maximum inspected depth. A nonnegative safe integer. |
| `ariaLabel` | `string` | `'JSON data'` | Accessible name of the data tree. |
| `className` | `string` | — | Class names on the outer inspector. |
| `style` | `CSSProperties` | — | Inline styles on the outer inspector. |
| `onSelect` | `(selection: Selection) => void` | — | Called when a row or path is selected. |
| `onCopy` | `(event: CopyEvent) => void` | — | Called after a successful clipboard operation. |
| `onCopyError` | `(error: Error) => void` | — | Called on serialization or clipboard failure; the UI also announces the error. |
| `copyText` | `(text: string) => Promise<void>` | Browser writer | Override clipboard access for a desktop host or custom integration. Reject to report failure. |

Expansion is managed internally. `defaultExpandedDepth` sets the baseline; individual and global actions override it. Replacing the data reference rebuilds the snapshot and resets selection, expansion and viewport position. Mutating the same object in place does not rebuild it.

### Type exports and callbacks

```tsx
import { JsonGlance } from 'json-glance';
import type {
  JsonGlanceProps,
  JsonValue,
  Selection,
  CopyEvent,
  CopyKind,
  ValueType,
} from 'json-glance';

// Selection: { path: string; value: unknown; type: ValueType }
// CopyEvent: { text: string; kind: CopyKind; path: string }
// CopyKind: 'json' | 'value' | 'path'
// JsonValue: recursive JSON string/number/boolean/null/array/object type.
// ValueType: the union of the inspector's rendered value types.

export function Inspector({ data }: { data: JsonValue }) {
  const handleSelect = ({ path, type }: Selection) => {
    console.log('Selected', path, type);
  };

  return <JsonGlance data={data} onSelect={handleSelect} />;
}
```

The runtime export is `JsonGlance`. The six types above are type-only exports. `ValueType` includes `object`, `array`, `string`, `number`, `boolean`, `null`, `undefined`, `date`, `url`, `bigint`, `symbol`, `function`, `circular`, `accessor` and `unknown`. The stylesheet is exported as `json-glance/styles.css`; JavaScript modules are tree-shakeable and CSS is marked as a side effect.

### Copy semantics

**Copy value** copies strings as their raw text, without JSON quotes. Containers and other values are serialized as readable JSON with two-space indentation. **Copy JSON** serializes the whole root. **Copy path** copies the exact canonical path.

For ordinary JSON data, the output is JSON. JavaScript-only values use explicit quoted markers instead of disappearing or throwing:

| Value | Serialized representation |
| --- | --- |
| `undefined` or a sparse array hole | `"[Undefined]"` |
| `123n` | `"[BigInt: 123n]"` |
| `NaN` / `Infinity` | `"[NaN]"` / `"[Infinity]"` |
| `Date` object | `"[Date: 2026-09-30T00:00:00.000Z]"` |
| `URL` object | `"[URL: https://example.com/]"` |
| Getter | `"[Getter]"` |
| Circular reference | `"[Circular → $]"`, with the referenced ancestor path |

Functions, symbols and unreadable values also receive descriptive markers. Shared references that are not ancestors are expanded separately. These markers are a readable export format, not a reversible JavaScript serializer.

Clipboard access happens only after a copy action. The default writer uses the browser Clipboard API with a checked legacy fallback. If neither succeeds, the component shows an accessible failure message and invokes `onCopyError`.

## Themes and customization

All classes and custom properties use the `jg-` prefix. Import the supplied stylesheet before your overrides, then target your own root class:

```tsx
<JsonGlance data={metadata} theme="light" className="audit-inspector" />
```

```css
.jg-inspector.audit-inspector {
  --jg-bg: #fffefb;
  --jg-surface: #f7f4ec;
  --jg-border: #e4dccb;
  --jg-accent: #80602d;
  --jg-selected: #faf0dd;
  --jg-indent-levels: 10;
  border-radius: 8px;
}
```

Available color properties are `--jg-bg`, `--jg-surface`, `--jg-border`, `--jg-text`, `--jg-muted`, `--jg-key`, `--jg-string`, `--jg-number`, `--jg-boolean`, `--jg-null`, `--jg-accent`, `--jg-selected`, `--jg-hover`, `--jg-highlight` and `--jg-warning`. `--jg-indent-levels` caps visual indentation while preserving the actual path and accessible depth.

Rows use a fixed **32px** height for virtualization. Keep that height when customizing row appearance.

## Data boundaries and performance

The inspector builds a bounded snapshot of own enumerable string-keyed properties. It reads property descriptors and does not evaluate getters or `toJSON`. Accessors appear as markers. Symbol-keyed properties are omitted; symbols used as values are displayed. `Map`, `Set` and custom instances expose their own enumerable properties, not their full iterator contents. Convert those values into records or arrays if you want to inspect their entries.

The default limits are **50,000 indexed nodes** and **64 levels**. Omitted branches have visible limit indicators and warnings. Search, navigation and global expansion operate only on indexed data. `Reflect.ownKeys` still enumerates an object's keys before descriptor inspection can be bounded, so extraordinarily wide objects can incur enumeration cost. Virtualization bounds rendered rows; it does not remove snapshot or search cost.

Trees with more than **200 visible rows** render a window of fixed-height rows with overscan. Deep indentation is capped visually to keep values usable on small screens. Long-value previews bound row text, while Details exposes the original full string.

Copying always uses the serializer's default **50,000-node / 64-level** limits, even if the viewer uses custom limits. A copy that exceeds those limits fails explicitly instead of exporting an incomplete payload. Lower viewer limits therefore do not imply that a copy will contain only the visible snapshot. Strings have no overall byte limit, and a large full-value copy can still require noticeable work.

Server rendering is supported: importing and rendering the component does not access the clipboard or DOM. Browser interaction begins after hydration. In Next.js, import CSS in the appropriate application stylesheet entry and keep interactive callbacks in a client component; the package preserves its client boundary.

## Migrating a metadata wrapper

A host can keep its existing card/layout and replace its internal renderer:

```tsx
import { JsonGlance } from 'json-glance';
import 'json-glance/styles.css';

export function Metadata({
  metadata,
}: {
  metadata: Record<string, unknown> | null;
}) {
  return <JsonGlance data={metadata} rootLabel="metadata" />;
}
```

The library deliberately displays empty and null roots. If your application should hide those states, apply that rule in the host wrapper. The [original implementation audit](docs/original-audit.md) documents the extraction and the defects addressed without bringing route, API or branding dependencies into the package.

## Playground and local development

Use Node.js 20 or later; Node.js 22 is used for project validation.

```sh
git clone https://github.com/SoarLabz/json-glance.git
cd json-glance
npm ci
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The playground imports the library as a package and includes simple objects, transaction-style synthetic metadata, nested structures, large arrays, long strings, empty values, URLs, dates, JavaScript edge cases and a larger performance dataset. Its controls demonstrate the **Tree only** preset, theme, depth, type labels, copying, search and preview settings. The React code tab updates with your chosen settings.

The development command builds once, watches TypeScript and CSS changes, and starts Vite on port 4173. The playground consumes the resulting package build as you edit the library.

```sh
npm run check          # build, lint, typecheck, unit tests, playground build, package checks
npx playwright install chromium
npm run test:e2e       # browser interaction and visual/layout checks
npm pack              # rebuild and inspect the distributable tarball
```

`npm run test:package` validates the packed contents and an external consumer import. The published files are `dist/`, `README.md`, `LICENSE` and npm's package metadata. The playground, audit, screenshots, tests, local configuration and credentials are excluded from the package.

Use commit messages in the form `type(context): short message in english`, for example `fix(keyboard): preserve focus after expansion`.

## Releases and npm publication

Publication runs only when a stable GitHub Release is **published** for a tag such as `v1.0.0`. The tag must match `package.json`, and the release workflow runs the quality and package checks before publishing. Draft releases, prereleases and ordinary branch pushes do not publish to npm.

Maintainers configure **`NPM_TOKEN` exclusively as a GitHub Actions Secret**. The workflow uses that secret for npm authentication. Do not put credentials in source files, `.npmrc`, commits, logs or release notes.

The initial project setup does not create a release or publish the package. For the first publication, configure the secret, confirm the validated commit and package version, then publish the matching GitHub Release. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development and release checklist.

## License

[MIT](LICENSE), © SoarLabz.
