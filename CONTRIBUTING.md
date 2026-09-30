# Contributing to json-glance

Contributions that improve reliable data inspection, accessibility or integration are welcome. Keep the component generic: host applications own their layouts, authentication, data fetching and domain rules.

## Set up

Use Node.js 22 for the same environment as project validation. The package supports Node.js 20 or later for tooling and React 18.2/19 for consumers.

```sh
npm ci
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The development command builds the library once, watches TypeScript and CSS changes, and starts Vite. The playground consumes that package build as it changes.

The main areas are:

| Path | Purpose |
| --- | --- |
| `src/JsonGlance.tsx` | Rendering, expansion, selection, keyboard navigation and copy controls. |
| `src/model.ts` | Bounded snapshots, paths, type recognition, filtering and safe serialization. |
| `src/styles.css` | Scoped `jg-` styles, themes and responsive layout. |
| `src/types.ts` | Public component and callback types. |
| `tests/` | Model, clipboard and React behavior regression coverage. |
| `playground/` | Synthetic datasets, real package integration and browser demonstration. |
| `scripts/` | Build, packed-package validation and release validation. |
| `docs/` | Screenshot and source implementation audit. |

## Development standards

- Preserve strict TypeScript. Use `unknown` and narrow values; do not introduce `any` or type-safety suppression.
- Keep runtime dependencies minimal. React is the only runtime peer, and CSS is a separate export.
- Do not evaluate input getters or `toJSON`. Keep property inspection and serialization within explicit bounds.
- Preserve primitive distinctions, valid JSON paths, empty states and honest clipboard failure reporting.
- Maintain keyboard navigation, accessible labels and a keyboard entry point when virtual rows change.
- Keep rows at 32px while virtualization depends on that constant. Scope styles with the `jg-` prefix and respect reduced motion.
- Use synthetic data in examples and tests. Do not add credentials, personal data or private application payloads.
- Update the README when changing public props, exports, limits or copy semantics.

Data passed to the component should change immutably. Expansion and selection are internal state; introducing controlled state or editing features would require an explicit API design discussion.

## Validate changes

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm pack
```

`check` runs the library build, lint, strict typechecks, unit tests, playground build and packed-package checks. Browser tests complement it with actual scrolling, path navigation, keyboard interaction and layout behavior. `npm pack` runs the library build through `prepack` and creates the distributable tarball.

For a focused iteration, use `npm test`, `npm run test:watch`, `npm run typecheck` or `npm run test:package`. Before submitting a pull request, run the complete checks and describe what changed, why, how you verified it and any remaining limitation.

Use commit messages in the form `type(context): short message in english`, for example `fix(keyboard): preserve focus after expansion` or `docs(api): explain copy limits`.

Regressions deserve a behavioral test when they affect data correctness, clipboard results, expansion, focus, search or bounded rendering. Avoid tests that only restate implementation details. Check light/dark themes and a narrow viewport when changing the UI.

## Package boundary

The package is ESM only and exports `JsonGlance`, its public types, `styles.css` and package metadata. JavaScript is tree-shakeable; CSS is the declared side effect. Built declarations must resolve without consumer access to the repository source.

The npm allowlist includes `dist/`, `README.md` and `LICENSE`. npm also includes its required package metadata. Playground sources, screenshots, audits, test files, CI configuration and local artifacts must remain outside the tarball. The package verification script checks contents and installs the archive into an external consumer.

Before a release, inspect the actual `npm pack` contents and confirm that no original application dependency or private path is present.

## Release process

Use semantic versioning. Breaking public API or behavior changes require a major version; backward-compatible features use a minor version; fixes use a patch version.

1. Update `package.json` and its lockfile to the intended version; describe the user-facing changes in release notes.
2. Run `npm run check` and `npm run test:e2e` on the release commit. Inspect `npm pack` and verify its external consumer test.
3. Confirm that the npm package name is available for the first release, or that the intended version has not already been published for later releases.
4. Configure `NPM_TOKEN` as a repository GitHub Actions Secret. Keep all credentials out of source, local committed configuration, command output and release notes.
5. Create the matching stable tag, such as `v1.0.0`, on the validated commit and publish its GitHub Release.
6. Follow the release workflow through validation and npm publication; verify the resulting package version before announcing the release.

The publishing workflow runs only for a published stable GitHub Release with a version-matching tag. Branch pushes, draft releases and prereleases do not publish. A release should not bypass the quality or package checks.

The initial repository setup intentionally prepares publication without creating a tag, GitHub Release or npm release. Maintainers perform that first release after the secret is configured and validation is complete.

## License

Contributions are distributed under the project's [MIT license](LICENSE).
