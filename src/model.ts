/** The types rendered by the inspector. */
export type NodeType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'date'
  | 'url'
  | 'bigint'
  | 'symbol'
  | 'function'
  | 'circular'
  | 'accessor'
  | 'unknown';

/** A bounded snapshot: rendering does not read properties from the input again. */
export interface DataNode {
  id: string;
  path: string;
  key: string;
  depth: number;
  type: NodeType;
  value: unknown;
  display: string;
  children: DataNode[];
  parentId: string | null;
  size: number;
  truncated: boolean;
}

export interface TreeModel {
  root: DataNode;
  nodes: Map<string, DataNode>;
  warnings: string[];
}

export interface TreeOptions {
  rootLabel?: string;
  maxNodes?: number;
  maxDepth?: number;
}

export interface SearchResult {
  matches: Set<string>;
  visible: Set<string>;
  expanded: Set<string>;
}

const DEFAULT_MAX_NODES = 50_000;
const DEFAULT_MAX_DEPTH = 64;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z)?$/;

function quoted(value: string): string {
  return JSON.stringify(value);
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function propertyPath(parent: DataNode, key: string): string {
  if (parent.type === 'array' && ARRAY_INDEX.test(key) && Number(key) < 4_294_967_295) {
    return `${parent.path}[${key}]`;
  }
  return IDENTIFIER.test(key) ? `${parent.path}.${key}` : `${parent.path}[${quoted(key)}]`;
}

function accessorDisplay(descriptor: PropertyDescriptor): string {
  if (descriptor.get && descriptor.set) return '[Getter/Setter]';
  return descriptor.get ? '[Getter]' : '[Setter]';
}

function functionDisplay(value: object): string {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'name');
    const name: unknown = descriptor?.value;
    return typeof name === 'string' && name ? `[Function ${name}]` : '[Function]';
  } catch {
    return '[Function]';
  }
}

function classify(value: unknown): { type: NodeType; display: string } {
  if (value === null) return { type: 'null', display: 'null' };
  switch (typeof value) {
    case 'string': return { type: getStringKind(value), display: quoted(value) };
    case 'number': return { type: 'number', display: Object.is(value, -0) ? '-0' : String(value) };
    case 'boolean': return { type: 'boolean', display: String(value) };
    case 'undefined': return { type: 'undefined', display: 'undefined' };
    case 'bigint': return { type: 'bigint', display: `${value}n` };
    case 'symbol': return { type: 'symbol', display: String(value) };
    case 'function': return { type: 'function', display: functionDisplay(value) };
    case 'object': {
      try {
        if (Array.isArray(value)) return { type: 'array', display: '[]' };
        if (value instanceof Date) {
          const time = Date.prototype.getTime.call(value);
          return {
            type: 'date',
            display: Number.isNaN(time) ? 'Invalid Date' : Date.prototype.toISOString.call(value),
          };
        }
        if (typeof URL !== 'undefined' && value instanceof URL) {
          // Some environments expose a subclass of the native URL constructor.
          // Find its intrinsic getter rather than reading an input href getter.
          let prototype: object | null = URL.prototype;
          for (let index = 0; prototype !== null && index < 8; index += 1) {
            const getter = Object.getOwnPropertyDescriptor(prototype, 'href')?.get;
            if (getter) {
              const href: unknown = getter.call(value);
              if (typeof href === 'string') {
                return getStringKind(href) === 'url'
                  ? { type: 'url', display: href }
                  : { type: 'unknown', display: `[URL: ${href}]` };
              }
              break;
            }
            const next: unknown = Object.getPrototypeOf(prototype);
            prototype = typeof next === 'object' ? next : null;
          }
        }
        return { type: 'object', display: '{}' };
      } catch {
        return { type: 'unknown', display: '[Unreadable object]' };
      }
    }
  }
  return { type: 'unknown', display: '[Unknown value]' };
}

function createNode(value: unknown, key: string, path: string, depth: number, parentId: string | null): DataNode {
  const classification = classify(value);
  return {
    id: path,
    path,
    key,
    depth,
    parentId,
    value,
    type: classification.type,
    display: classification.display,
    children: [],
    size: 0,
    truncated: false,
  };
}

interface PropertyEntry {
  key: string;
  descriptor: PropertyDescriptor | undefined;
}

interface PropertySnapshot {
  entries: PropertyEntry[];
  limited: boolean;
}

function properties(value: object, descriptorBudget: number): PropertySnapshot {
  const entries: PropertyEntry[] = [];
  let inspected = 0;
  for (const key of Reflect.ownKeys(value)) {
    // JSONPath addresses string keys; symbols are supported as values.
    if (typeof key !== 'string') continue;
    if (inspected >= descriptorBudget) return { entries, limited: true };
    inspected += 1;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable) entries.push({ key, descriptor });
    } catch {
      entries.push({ key, descriptor: undefined });
    }
  }
  return { entries, limited: false };
}

type BuildFrame =
  | { kind: 'enter'; node: DataNode }
  | { kind: 'iterate'; node: DataNode; object: object; entries: PropertyEntry[]; index: number }
  | { kind: 'exit'; object: object };

/**
 * Snapshot own enumerable string keys without evaluating getters or toJSON.
 * The walk is iterative and bounded; repeated references are expanded unless
 * they point to an ancestor in the current branch.
 */
export function buildTree(data: unknown, options: TreeOptions = {}): TreeModel {
  const maxNodes = boundedInteger(options.maxNodes, DEFAULT_MAX_NODES, 1, 'maxNodes');
  const maxDepth = boundedInteger(options.maxDepth, DEFAULT_MAX_DEPTH, 0, 'maxDepth');
  const root = createNode(data, options.rootLabel ?? 'root', '$', 0, null);
  const nodes = new Map<string, DataNode>([[root.id, root]]);
  const warnings = new Set<string>();
  const ancestors = new WeakMap<object, string>();
  const stack: BuildFrame[] = [{ kind: 'enter', node: root }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) continue;
    if (frame.kind === 'exit') {
      ancestors.delete(frame.object);
      continue;
    }
    if (frame.kind === 'iterate') {
      const entry = frame.entries[frame.index];
      if (!entry) continue;
      if (nodes.size >= maxNodes) {
        frame.node.truncated = true;
        warnings.add(`Node limit (${maxNodes}) reached; some properties are omitted.`);
        continue;
      }
      const path = propertyPath(frame.node, entry.key);
      const value: unknown = entry.descriptor?.value;
      const child = createNode(value, entry.key, path, frame.node.depth + 1, frame.node.id);
      if (!entry.descriptor) {
        child.type = 'unknown';
        child.display = '[Unreadable property]';
        warnings.add(`Unable to inspect property ${path}.`);
      } else if (!('value' in entry.descriptor)) {
        child.type = 'accessor';
        child.display = accessorDisplay(entry.descriptor);
      }
      frame.node.children.push(child);
      nodes.set(child.id, child);
      stack.push({ ...frame, index: frame.index + 1 }, { kind: 'enter', node: child });
      continue;
    }

    const node = frame.node;
    if (node.type === 'unknown') {
      if (node.display.startsWith('[Unreadable')) warnings.add(`Unable to inspect value at ${node.path}.`);
      continue;
    }
    if ((node.type !== 'object' && node.type !== 'array') || typeof node.value !== 'object' || node.value === null) continue;
    const object = node.value;
    const ancestorPath = ancestors.get(object);
    if (ancestorPath !== undefined) {
      node.type = 'circular';
      node.display = `[Circular → ${ancestorPath}]`;
      continue;
    }

    let snapshot: PropertySnapshot;
    try {
      // Reflect.ownKeys necessarily enumerates keys, but property descriptors
      // are inspected only within the remaining node/depth safety budget.
      const descriptorBudget = node.depth >= maxDepth ? 1 : Math.max(1, maxNodes - nodes.size + 1);
      snapshot = properties(object, descriptorBudget);
      const length: unknown = node.type === 'array' ? Object.getOwnPropertyDescriptor(object, 'length')?.value : undefined;
      node.size = typeof length === 'number' ? length : snapshot.entries.length;
      node.display = node.type === 'array'
        ? node.size === 0 ? '[]' : `[${node.size} ${node.size === 1 ? 'item' : 'items'}]`
        : snapshot.limited ? `{${node.size}+ keys}` : node.size === 0 ? '{}' : `{${node.size} ${node.size === 1 ? 'key' : 'keys'}}`;
    } catch {
      node.type = 'unknown';
      node.display = '[Unreadable object]';
      warnings.add(`Unable to inspect properties at ${node.path}.`);
      continue;
    }

    const entries = snapshot.entries;
    if (entries.length === 0 && !snapshot.limited) continue;
    if (node.depth >= maxDepth) {
      node.truncated = true;
      warnings.add(`Depth limit (${maxDepth}) reached at ${node.path}; nested properties are omitted.`);
      continue;
    }
    if (snapshot.limited) {
      node.truncated = true;
      warnings.add(`Node limit (${maxNodes}) reached; some properties are omitted.`);
    }
    ancestors.set(object, node.path);
    stack.push({ kind: 'exit', object }, { kind: 'iterate', node, object, entries, index: 0 });
  }

  return { root, nodes, warnings: [...warnings] };
}

/** Matches key, value preview and JSONPath, revealing only matching branches. */
export function searchTree(model: TreeModel, query: string): SearchResult {
  const matches = new Set<string>();
  const visible = new Set<string>();
  const expanded = new Set<string>();
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return { matches, visible, expanded };
  for (const node of model.nodes.values()) {
    const rawString = typeof node.value === 'string' ? node.value : '';
    if (![node.key, node.display, node.path, rawString].some((text) => text.toLocaleLowerCase().includes(needle))) continue;
    matches.add(node.id);
    visible.add(node.id);
    let parentId = node.parentId;
    while (parentId !== null) {
      visible.add(parentId);
      expanded.add(parentId);
      parentId = model.nodes.get(parentId)?.parentId ?? null;
    }
  }
  return { matches, visible, expanded };
}

/** Return the visible rows in depth-first order without recursive calls. */
export function flattenTree(root: DataNode, isExpanded: (node: DataNode) => boolean, visible?: ReadonlySet<string>): DataNode[] {
  const rows: DataNode[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || (visible && !visible.has(node.id))) continue;
    rows.push(node);
    if (!isExpanded(node)) continue;
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child) stack.push(child);
    }
  }
  return rows;
}

function literal(node: DataNode): string {
  switch (node.type) {
    case 'string': return typeof node.value === 'string' ? quoted(node.value) : quoted(node.display);
    case 'number': return typeof node.value === 'number' && Number.isFinite(node.value)
      ? String(Object.is(node.value, -0) ? 0 : node.value)
      : quoted(`[${node.display}]`);
    case 'boolean': return node.value === true ? 'true' : 'false';
    case 'null': return 'null';
    case 'undefined': return quoted('[Undefined]');
    case 'bigint': return quoted(`[BigInt: ${node.display}]`);
    case 'date': return typeof node.value === 'string' ? quoted(node.value) : quoted(`[Date: ${node.display}]`);
    case 'url': return typeof node.value === 'string' ? quoted(node.value) : quoted(`[URL: ${node.display}]`);
    case 'symbol': return quoted(`[${node.display}]`);
    default: return quoted(node.display);
  }
}

type SerializeFrame = { kind: 'node'; node: DataNode; depth: number } | { kind: 'text'; text: string };

/**
 * Pretty JSON for JSON input, with quoted markers for JavaScript-only values.
 * Getters and toJSON are never evaluated. Incomplete snapshots fail explicitly.
 */
export function serializeValue(value: unknown): string {
  const model = buildTree(value);
  if ([...model.nodes.values()].some((node) => node.truncated)) {
    throw new RangeError('Cannot copy the complete value: the node or depth safety limit was reached.');
  }
  const chunks: string[] = [];
  const stack: SerializeFrame[] = [{ kind: 'node', node: model.root, depth: 0 }];
  let serializedItems = 0;
  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) continue;
    if (frame.kind === 'text') {
      chunks.push(frame.text);
      continue;
    }
    const node = frame.node;
    if (node.type !== 'array' && node.type !== 'object') {
      chunks.push(literal(node));
      continue;
    }
    const isArray = node.type === 'array';
    const children: (DataNode | undefined)[] = [];
    if (isArray) {
      serializedItems += node.size;
      if (serializedItems > DEFAULT_MAX_NODES) {
        throw new RangeError('Cannot copy the complete array: the item safety limit was reached.');
      }
      const indexed = new Map<number, DataNode>();
      for (const child of node.children) {
        if (ARRAY_INDEX.test(child.key) && Number(child.key) < node.size) indexed.set(Number(child.key), child);
      }
      for (let index = 0; index < node.size; index += 1) children.push(indexed.get(index));
    } else {
      children.push(...node.children);
    }
    const open = isArray ? '[' : '{';
    const close = isArray ? ']' : '}';
    if (children.length === 0) {
      chunks.push(open + close);
      continue;
    }
    chunks.push(`${open}\n`);
    stack.push({ kind: 'text', text: `\n${'  '.repeat(frame.depth)}${close}` });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (index < children.length - 1) stack.push({ kind: 'text', text: ',\n' });
      stack.push(child ? { kind: 'node', node: child, depth: frame.depth + 1 } : { kind: 'text', text: quoted('[Undefined]') });
      stack.push({ kind: 'text', text: `${'  '.repeat(frame.depth + 1)}${isArray || !child ? '' : `${quoted(child.key)}: `}` });
    }
  }
  return chunks.join('');
}

/** Identify safe links and strictly valid ISO dates without local-time guesses. */
export function getStringKind(value: string): 'string' | 'url' | 'date' {
  if (/^https?:\/\//i.test(value) && value === value.trim() && !hasUrlControl(value)) {
    try {
      const url = new URL(value);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname && !url.username && !url.password) return 'url';
    } catch {
      // A malformed URL remains an ordinary string.
    }
  }
  const match = ISO_DATE.exec(value);
  if (!match) return 'string';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  const milliseconds = Number((match[7] ?? '').padEnd(3, '0'));
  if (month < 1 || month > 12 || day < 1 || hours > 23 || minutes > 59 || seconds > 59) return 'string';
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hours, minutes, seconds, milliseconds);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? 'date' : 'string';
}

function hasUrlControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 32 || code === 127) return true;
  }
  return false;
}
