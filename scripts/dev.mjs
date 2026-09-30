import { spawn, spawnSync } from 'node:child_process';
import { copyFile, watchFile, unwatchFile } from 'node:fs';
const build = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const compiler = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' });
const server = spawn(npm, ['run', 'dev', '--workspace', '@json-glance/playground'], { stdio: 'inherit', shell: process.platform === 'win32' });
watchFile('src/styles.css', { interval: 200 }, () => copyFile('src/styles.css', 'dist/styles.css', error => { if (error) console.error(error.message); }));
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  unwatchFile('src/styles.css');
  compiler.kill(); server.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
compiler.on('error', error => { console.error(error.message); close(1); });
server.on('error', error => { console.error(error.message); close(1); });
compiler.on('exit', code => close(code ?? 1));
server.on('exit', code => close(code ?? 0));
