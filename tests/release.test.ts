// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const releaseScript = fileURLToPath(new URL('../scripts/release-check.mjs', import.meta.url));
const temporaryRepositories = new Set<string>();

function git(directory: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(directory, '.git', 'disabled-global-config'),
    },
  }).trim();
}

function commitFile(directory: string, filename: string, content: string): void {
  writeFileSync(join(directory, filename), content);
  git(directory, ['add', '--', filename]);
  git(directory, ['commit', '-m', `Add ${filename}`]);
}

function createRepository(version = '1.0.0', createTag = true): string {
  const directory = mkdtempSync(join(tmpdir(), 'json-glance-release-test-'));
  temporaryRepositories.add(directory);
  git(directory, ['init', '--initial-branch=main']);
  git(directory, ['config', 'user.name', 'Release Test']);
  git(directory, ['config', 'user.email', 'release-test@example.invalid']);
  git(directory, ['config', 'commit.gpgsign', 'false']);
  git(directory, ['config', 'tag.gpgsign', 'false']);
  commitFile(directory, 'package.json', JSON.stringify({ name: 'release-fixture', version }, null, 2));
  if (createTag) git(directory, ['tag', 'v1.0.0']);
  git(directory, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  return directory;
}

function checkRelease(directory: string, tag?: string): string {
  const environment = { ...process.env };
  if (tag === undefined) delete environment.RELEASE_TAG;
  else environment.RELEASE_TAG = tag;
  return execFileSync(process.execPath, [releaseScript], {
    cwd: directory,
    encoding: 'utf8',
    stdio: 'pipe',
    env: environment,
  });
}

afterEach(() => {
  for (const directory of temporaryRepositories) rmSync(directory, { recursive: true, force: true });
  temporaryRepositories.clear();
});

describe('release-check', () => {
  it('accepts a stable matching tag at HEAD that belongs to origin/main', () => {
    const directory = createRepository();
    expect(checkRelease(directory, 'v1.0.0')).toContain('Release v1.0.0 matches package version and belongs to main.');
  });

  it('requires RELEASE_TAG instead of inheriting an unspecified release', () => {
    expect(() => checkRelease(createRepository())).toThrow(/RELEASE_TAG is required/);
  });

  it.each(['release-1.0.0', '1.0.0', 'v1.0', 'v1.0.0-beta.1', 'v1.0.0+build'])('rejects malformed or non-stable tags: %s', (tag) => {
    expect(() => checkRelease(createRepository(), tag)).toThrow(/Only stable semantic version tags can publish/);
  });

  it('rejects a tag that does not exist in the checkout', () => {
    expect(() => checkRelease(createRepository('1.0.0', false), 'v1.0.0')).toThrow(/v1\.0\.0\^\{commit\}/);
  });

  it('rejects a release tag pointing to another commit', () => {
    const directory = createRepository();
    commitFile(directory, 'after-release.txt', 'A commit after the release tag.');
    git(directory, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    expect(() => checkRelease(directory, 'v1.0.0')).toThrow(/Checkout must match the release tag/);
  });

  it('rejects a release tag that differs from package.json version', () => {
    expect(() => checkRelease(createRepository('1.1.0'), 'v1.0.0')).toThrow(/Release tag must match package.json version/);
  });

  it('rejects a matching tagged commit outside origin/main history', () => {
    const directory = createRepository();
    git(directory, ['checkout', '-b', 'unmerged-release']);
    commitFile(directory, 'unmerged.txt', 'This tagged commit is outside origin/main.');
    git(directory, ['tag', '--force', 'v1.0.0']);
    expect(() => checkRelease(directory, 'v1.0.0')).toThrow(/merge-base --is-ancestor HEAD origin\/main/);
  });
});
