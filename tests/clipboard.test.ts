import { describe, it, expect, vi } from 'vitest';
import { writeClipboard } from '../src/clipboard.js';
describe('clipboard fallback', () => {
  it('checks the actual copy result and cleans up its element', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    await expect(writeClipboard('hello')).rejects.toThrow('Could not copy');
    expect(document.querySelector('textarea')).toBeNull();
    execCommand.mockReturnValue(true);
    await expect(writeClipboard('hello')).resolves.toBeUndefined();
    expect(document.querySelector('textarea')).toBeNull();
    vi.unstubAllGlobals();
  });
});
