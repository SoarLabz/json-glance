import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const root = process.cwd();
const temporary = await mkdtemp(join(tmpdir(), 'json-glance-package-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const packed = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', temporary]));
  const pack = packed[0];
  assert(pack, 'npm pack did not return a package');
  for (const file of pack.files) {
    assert(/^(?:dist\/[A-Za-z0-9._-]+\.(?:js|d\.ts|css)|README\.md|LICENSE|package\.json)$/.test(file.path), `Unexpected package file: ${file.path}`);
    const content = await readFile(join(root, file.path), 'utf8');
    assert(!/npm_[A-Za-z0-9]{20,}/.test(content), `Credential pattern in ${file.path}`);
    assert(!/from\s*['"]@\/|workspace:|\/home\/|soarlabz-whitelabel-monorepo/.test(content), `Internal source reference in ${file.path}`);
  }
  assert(pack.files.some(file => file.path === 'README.md'), 'README missing');
  assert(pack.files.some(file => file.path === 'LICENSE'), 'License missing');
  assert(pack.files.some(file => file.path === 'dist/styles.css'), 'Styles missing');
  assert(pack.files.some(file => file.path === 'dist/index.d.ts'), 'Declarations missing');
  run(process.execPath, [resolve('node_modules/publint/src/cli.js')]);
  // Install the real tarball outside the workspace, using both supported React majors.
  for (const version of ['18.3.1', '19.2.4']) {
    const consumer = join(temporary, `react-${version}`);
    await mkdir(consumer);
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(temporary, pack.filename), `react@${version}`, `react-dom@${version}`, '@types/react@19', '@types/react-dom@19'], consumer);
    await writeFile(join(consumer, 'verify.mjs'), `import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { JsonGlance } from 'json-glance';
const html = renderToString(createElement(JsonGlance, { data: { success: true, count: 7 } }));
assert(html.includes('success') && html.includes('count'));
assert(import.meta.resolve('json-glance/styles.css').endsWith('/dist/styles.css'));
console.log('External React ${version}: ESM import, CSS export and server render passed.');\n`);
    await writeFile(join(consumer, 'index.tsx'), `import { JsonGlance } from 'json-glance';
import type { JsonValue, JsonGlanceProps, Selection, CopyEvent } from 'json-glance';
const data: JsonValue = { success: true, tags: [null, 7] };
const props: JsonGlanceProps = { data, onSelect: (selection: Selection) => { console.log(selection.path); }, onCopy: (event: CopyEvent) => { console.log(event.kind); } };
export const view = <JsonGlance {...props} />;\n`);
    await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: false, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', jsx: 'react-jsx', types: ['react', 'react-dom'] }, include: ['index.tsx'] }));
    console.log(run(process.execPath, ['verify.mjs'], consumer).trim());
    run(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], consumer);
  }
  console.log(`Package verified: ${pack.filename} · ${pack.files.length} files · ${pack.size} bytes packed · ${pack.unpackedSize} bytes unpacked.`);
  console.log(pack.files.map(file => file.path).join('\n'));
} finally { await rm(temporary, { recursive: true, force: true }); }
