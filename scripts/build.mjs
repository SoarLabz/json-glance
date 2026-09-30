import { spawnSync } from 'node:child_process';
import { copyFile, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await copyFile('src/styles.css', 'dist/styles.css');
