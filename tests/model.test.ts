import { describe, expect, it, vi } from 'vitest';
import { buildTree, flattenTree, getStringKind, searchTree, serializeValue } from '../src/model.js';

describe('buildTree', () => {
  it('snapshots nested JSON with unambiguous JSONPaths', () => {
    const model = buildTree({ invoice: [{ 'odd.key': true, 'quote"key': null }], empty: {}, list: [] });
    expect([...model.nodes.keys()]).toEqual([
      '$', '$.invoice', '$.invoice[0]', '$.invoice[0]["odd.key"]', '$.invoice[0]["quote\\"key"]', '$.empty', '$.list',
    ]);
    expect(model.nodes.get('$.invoice[0]["odd.key"]')).toMatchObject({ type: 'boolean', depth: 3, parentId: '$.invoice[0]' });
    expect(model.nodes.get('$.empty')).toMatchObject({ type: 'object', size: 0, display: '{}' });
    expect(model.nodes.get('$.list')).toMatchObject({ type: 'array', size: 0, display: '[]' });
    expect(model.warnings).toEqual([]);
  });

  it('supports JavaScript values and does not evaluate input methods or accessors', () => {
    const getter = vi.fn(() => 'secret');
    const toJSON = vi.fn(() => { throw new Error('Never call input methods'); });
    const input = {
      date: new Date('2026-09-30T12:00:00Z'), url: new URL('https://example.com/path'), missing: undefined,
      nan: Number.NaN, infinity: Infinity, bigint: 42n, symbol: Symbol('token'), toJSON,
    };
    Object.defineProperty(input, 'getter', { enumerable: true, get: getter });
    const model = buildTree(input);
    expect(model.nodes.get('$.date')?.type).toBe('date');
    expect(model.nodes.get('$.url')?.display).toBe('https://example.com/path');
    expect(model.nodes.get('$.getter')).toMatchObject({ type: 'accessor', display: '[Getter]' });
    expect(model.nodes.get('$.missing')?.type).toBe('undefined');
    expect(model.nodes.get('$.bigint')?.display).toBe('42n');
    expect(model.nodes.get('$.symbol')?.type).toBe('symbol');
    expect(model.nodes.get('$.toJSON')?.type).toBe('function');
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('distinguishes circular ancestors from shared references', () => {
    const shared = { value: 7 };
    const input: { first: typeof shared; second: typeof shared; self?: unknown } = { first: shared, second: shared };
    input.self = input;
    const model = buildTree(input);
    expect(model.nodes.get('$.first.value')?.display).toBe('7');
    expect(model.nodes.get('$.second.value')?.display).toBe('7');
    expect(model.nodes.get('$.self')).toMatchObject({ type: 'circular', display: '[Circular → $]' });
    expect(model.warnings).toEqual([]);
  });

  it('bounds traversal by nodes and depth and marks incomplete containers', () => {
    const byNodes = buildTree({ a: { b: 1, c: 2 }, d: 3 }, { maxNodes: 3 });
    expect(byNodes.nodes.size).toBe(3);
    expect(byNodes.root.truncated).toBe(true);
    expect(byNodes.nodes.get('$.a')?.truncated).toBe(true);
    expect(byNodes.warnings).toEqual(['Node limit (3) reached; some properties are omitted.']);
    const byDepth = buildTree({ a: { b: 1 } }, { maxDepth: 1 });
    expect([...byDepth.nodes.keys()]).toEqual(['$', '$.a']);
    expect(byDepth.nodes.get('$.a')?.truncated).toBe(true);
    expect(byDepth.warnings[0]).toContain('Depth limit (1)');
    expect(buildTree({}, { maxDepth: 0 }).warnings).toEqual([]);
    expect(() => buildTree(null, { maxNodes: 0 })).toThrow(RangeError);
    expect(() => buildTree(null, { maxDepth: Infinity })).toThrow(RangeError);
  });

  it('reports unreadable proxies without throwing', () => {
    const input = new Proxy({}, { ownKeys() { throw new Error('unreadable'); } });
    const model = buildTree(input);
    expect(model.root).toMatchObject({ type: 'unknown', display: '[Unreadable object]' });
    expect(model.warnings[0]).toContain('Unable to inspect');
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(buildTree(revoked.proxy).root.type).toBe('unknown');
  });

  it('never reads inherited or non-enumerable properties', () => {
    const input: Record<string, unknown> = { visible: 1 };
    Object.setPrototypeOf(input, { inherited: 2 });
    Object.defineProperty(input, 'hidden', { value: 3 });
    expect([...buildTree(input).nodes.keys()]).toEqual(['$', '$.visible']);
  });

  it('bounds descriptor inspection before reading large or depth-limited containers', () => {
    const input: Record<string, number> = {};
    for (let index = 0; index < 1_000; index += 1) input[`key${index}`] = index;
    const descriptor = vi.fn((target: object, key: string | symbol) => Object.getOwnPropertyDescriptor(target, key));
    const proxy = new Proxy(input, { getOwnPropertyDescriptor: descriptor });
    const limited = buildTree(proxy, { maxNodes: 5 });
    expect(limited.nodes.size).toBe(5);
    expect(limited.root.truncated).toBe(true);
    expect(limited.root.display).toBe('{5+ keys}');
    expect(descriptor).toHaveBeenCalledTimes(5);
    descriptor.mockClear();
    expect(buildTree(proxy, { maxDepth: 0 }).root.truncated).toBe(true);
    expect(descriptor).toHaveBeenCalledTimes(1);
  });

  it('classifies URL/date strings and never turns unsafe URL objects into links', () => {
    const model = buildTree({ link: 'https://example.com', date: '2026-09-30', unsafe: new URL('javascript:alert(1)') });
    expect(model.nodes.get('$.link')?.type).toBe('url');
    expect(model.nodes.get('$.date')?.type).toBe('date');
    expect(model.nodes.get('$.unsafe')?.type).not.toBe('url');
    expect(model.nodes.get('$.unsafe')?.display).toBe('[URL: javascript:alert(1)]');
    expect(model.warnings).toEqual([]);
  });

  it('handles thousands of nested objects without recursive traversal', () => {
    const input: Record<string, unknown> = {};
    let cursor = input;
    for (let index = 0; index < 10_000; index += 1) {
      const next: Record<string, unknown> = {};
      cursor.child = next;
      cursor = next;
    }
    const model = buildTree(input);
    expect(model.nodes.size).toBe(65);
    expect(model.warnings[0]).toContain('Depth limit (64)');
  });
});

describe('searchTree and flattenTree', () => {
  it('matches keys, paths and values case-insensitively and reveals ancestor chains', () => {
    const model = buildTree({ orders: [{ status: 'Approved', amount: 12 }], hidden: 'other' });
    const result = searchTree(model, 'APPROVED');
    expect([...result.matches]).toEqual(['$.orders[0].status']);
    expect(result.expanded).toEqual(new Set(['$.orders[0]', '$.orders', '$']));
    expect(flattenTree(model.root, (node) => result.expanded.has(node.id), result.visible).map((node) => node.id))
      .toEqual(['$', '$.orders', '$.orders[0]', '$.orders[0].status']);
    expect(searchTree(model, 'amount').matches.has('$.orders[0].amount')).toBe(true);
    expect(searchTree(model, '$.orders[0].status').matches.has('$.orders[0].status')).toBe(true);
    expect(searchTree(model, '   ').visible.size).toBe(0);
  });

  it('respects expansion state and preserves object order', () => {
    const model = buildTree({ first: { value: 1 }, second: [2, 3] });
    expect(flattenTree(model.root, (node) => node.depth === 0).map((node) => node.id)).toEqual(['$', '$.first', '$.second']);
    expect(flattenTree(model.root, () => true).map((node) => node.id)).toEqual([
      '$', '$.first', '$.first.value', '$.second', '$.second[0]', '$.second[1]',
    ]);
    expect(flattenTree(model.root, () => false)).toEqual([model.root]);
  });
});

describe('serializeValue', () => {
  it('matches pretty JSON for ordinary JSON without invoking input toJSON', () => {
    const input = { name: 'payment', values: [null, true, 1.25], nested: { 'quote"': 'line\nnext' }, empty: {}, url: 'https://example.com', date: '2026-09-30' };
    expect(serializeValue(input)).toBe(JSON.stringify(input, null, 2));
    const method = vi.fn(() => ({ altered: true }));
    const parsed: unknown = JSON.parse(serializeValue({ toJSON: method, value: 7 }));
    expect(parsed).toEqual({ toJSON: expect.stringMatching(/^\[Function(?: .+)?\]$/), value: 7 });
    expect(method).not.toHaveBeenCalled();
  });

  it('preserves exceptional values as explicit markers and shared values as objects', () => {
    const shared = { value: undefined };
    const input: Record<string, unknown> = {
      first: shared, second: shared, nan: NaN, positive: Infinity, negative: -Infinity, bigint: 9n, symbol: Symbol('test'),
      date: new Date('2026-09-30T00:00:00Z'), url: new URL('https://example.com'),
    };
    input.self = input;
    const parsed: unknown = JSON.parse(serializeValue(input));
    expect(parsed).toEqual({
      first: { value: '[Undefined]' }, second: { value: '[Undefined]' }, nan: '[NaN]', positive: '[Infinity]', negative: '[-Infinity]',
      bigint: '[BigInt: 9n]', symbol: '[Symbol(test)]', date: '[Date: 2026-09-30T00:00:00.000Z]',
      url: '[URL: https://example.com/]', self: '[Circular → $]',
    });
  });

  it('preserves accessors and prototype-looking keys safely', () => {
    const getter = vi.fn(() => { throw new Error('getter executed'); });
    const input: Record<string, unknown> = {};
    Object.defineProperty(input, 'secret', { enumerable: true, get: getter });
    Object.defineProperty(input, '__proto__', { enumerable: true, value: { safe: true } });
    expect(serializeValue(input)).toContain('"secret": "[Getter]"');
    expect(serializeValue(input)).toContain('"__proto__": {');
    expect(getter).not.toHaveBeenCalled();
  });

  it('marks sparse array holes and rejects serialization beyond safety limits', () => {
    const sparse: unknown[] = [];
    sparse[2] = 7;
    expect(JSON.parse(serializeValue(sparse))).toEqual(['[Undefined]', '[Undefined]', 7]);
    const huge: unknown[] = [];
    huge.length = 1_000_000;
    expect(() => serializeValue(huge)).toThrow(/safety limit/);
    const nested: Record<string, unknown> = {};
    let cursor = nested;
    for (let index = 0; index < 70; index += 1) {
      const next: Record<string, unknown> = {};
      cursor.child = next;
      cursor = next;
    }
    expect(() => serializeValue(nested)).toThrow(/safety limit/);
  });
});

describe('getStringKind', () => {
  it.each(['https://example.com', 'http://localhost:3000/path', 'HTTPS://example.com/a?b=1'])('recognizes safe absolute URLs: %s', (value) => {
    expect(getStringKind(value)).toBe('url');
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', '//example.com', '/relative', 'https://user:password@example.com', ' https://example.com', 'https://', 'https://exa\nmple.com', 'https://example.com/\tpath'])('leaves unsafe or malformed links as strings: %s', (value) => {
      expect(getStringKind(value)).toBe('string');
    });

  it.each(['2026-09-30', '2024-02-29', '2026-09-30T12:34:56Z', '2026-09-30T12:34:56.123Z', '0001-01-01'])('recognizes valid ISO dates: %s', (value) => {
    expect(getStringKind(value)).toBe('date');
  });

  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-09-00', '2026-09-30T24:00:00Z', '2026-09-30T12:00:00', '2026-09-30T12:00:00-03:00', '30/09/2026'])('rejects invalid or ambiguous date strings: %s', (value) => {
      expect(getStringKind(value)).toBe('string');
    });
});
