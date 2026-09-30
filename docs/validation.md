# Validation evidence

Validated on September 30, 2026, using Node.js 22.23.1 and a clean `npm ci` install.

| Check | Result |
| --- | --- |
| ESLint | Passed with zero warnings. |
| Strict TypeScript | Passed for the library, playground, unit tests and browser tests. |
| Unit/component/release tests | 69 passed across four files. |
| Library build | Passed; ESM, declarations and CSS generated. |
| Playground production build | Passed, using the package exports rather than source aliases. |
| Chromium desktop/mobile | 20 passed, no skipped scenarios. |
| External React 18.3.1 consumer | Tarball install, ESM import, CSS resolution, SSR and strict consumer typecheck passed. |
| External React 19.2.4 consumer | Tarball install, ESM import, CSS resolution, SSR and strict consumer typecheck passed. |
| publint | Passed without packaging findings. |
| npm archive allowlist | 16 files, containing only dist, README, LICENSE and package metadata. |
| Name availability | `json-glance` and normalized `jsonglance` both returned HTTP 404 from the npm registry. Availability is not a reservation. |

The archive's exact size, hashes and file manifest are recorded in [package-contents.json](package-contents.json). The tarball excludes original application code, playground files, screenshots, tests, CI files, local configuration and credentials.

## Browser coverage

The browser suite verifies all fourteen synthetic examples, safe getter/circular inspection, search through twenty collapsed levels, real clipboard JSON/path/value copying, full long string details, light/dark/system themes, configuration changes, generated example code, keyboard navigation after pointer expansion and layouts without page-level horizontal overflow. Tree-only coverage checks hidden surrounding controls, removal of hidden search filtering, keyboard access to row copying, explicit full-value details with a close action, and restoration of normal controls.

For the performance example, expanding all 27,001 indexed nodes keeps fewer than fifty rows mounted. The near-end path `$[2998].name` is selected, brought into the rendered window and focused. This verifies bounded DOM rendering and useful navigation; it is not a universal latency benchmark.

Desktop and mobile screenshots are saved as [playground.png](playground.png) and [playground-mobile.png](playground-mobile.png). The tree-only dark example is saved as [playground-minimal.png](playground-minimal.png). These were also visually inspected. Browser coverage uses Chromium; Firefox, Safari and assistive technology combinations have not been separately tested.

## Extraction boundary

The source audit reads the historical metadata card from `feat/charge-metadata-card`. The original checkout and all original application routes were left unchanged. The library has one runtime peer, React, and no original framework, styling, business-rule or internal package dependencies.

## Publication status

Versions publish through a stable, version-matching GitHub Release whose commit belongs to main, using the maintainer's `NPM_TOKEN` GitHub Actions Secret. The workflow validates the package before publishing its exact tarball with provenance. Release guards have eleven isolated Git fixture tests, including invalid tags, version mismatches and commits outside main. Version 1.0.0's npm publication failed before upload because its tarball path was interpreted as a Git repository; 1.0.1 fixes the explicit local path and checks file existence. Current publication results are available in the repository's Releases and Actions pages.
