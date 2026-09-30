'use client';

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { buildTree, flattenTree, searchTree, serializeValue } from './model.js';
import type { DataNode, TreeModel } from './model.js';
import type { CopyKind, JsonGlanceProps } from './types.js';
import { Icon } from './icons.js';
import { writeClipboard } from './clipboard.js';

const ROW_HEIGHT = 32;
const OVERSCAN = 8;
const VIRTUAL_THRESHOLD = 200;
const isContainer = (node: DataNode) => node.type === 'object' || node.type === 'array';
function bounded(value: number, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

/** A searchable, accessible inspector with no runtime dependencies beyond React. */
export function JsonGlance(props: JsonGlanceProps) {
  const { data, rootLabel = 'root', maxNodes = 50000, maxDepth = 64 } = props;
  const model = useMemo(() => buildTree(data, { rootLabel, maxNodes, maxDepth }), [data, rootLabel, maxNodes, maxDepth]);
  return <Inspector {...props} model={model} />;
}

type ExpansionMode = 'depth' | 'all' | 'none';
interface ViewState { model: TreeModel; mode: ExpansionMode; overrides: Map<string, boolean>; selectedId: string }
function initialView(model: TreeModel): ViewState {
  return { model, mode: 'depth', overrides: new Map(), selectedId: model.root.id };
}

function Inspector({
  model, defaultExpandedDepth = 2, searchable = true, copyable = true, showTypes = true,
  theme = 'auto', maxHeight = 420, stringLimit = 160, ariaLabel = 'JSON data', className, style,
  onSelect, onCopy, onCopyError, copyText = writeClipboard
}: JsonGlanceProps & { model: TreeModel }) {
  const uid = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const [view, setView] = useState(() => initialView(model));
  const [query, setQuery] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [pathError, setPathError] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [status, setStatus] = useState('');
  const [details, setDetails] = useState(false);
  const [copying, setCopying] = useState(false);
  // Reset expansion/selection for replacement data without a render using stale state.
  if (view.model !== model) { setView(initialView(model)); setScrollTop(0); }
  const current = view.model === model ? view : initialView(model);
  const effectiveQuery = useDeferredValue(searchable ? query.trim() : '');
  const search = useMemo(() => searchTree(model, effectiveQuery), [model, effectiveQuery]);
  const filtering = effectiveQuery.length > 0;
  const depth = bounded(defaultExpandedDepth, 2, 0, 65);
  const height = bounded(maxHeight, 420, 96);
  const limit = bounded(stringLimit, 160, 16);
  const rows = useMemo(() => flattenTree(model.root, node => {
    const override = current.overrides.get(node.id);
    if (override !== undefined) return override;
    if (filtering) return search.expanded.has(node.id);
    return current.mode === 'all' || (current.mode === 'depth' && node.depth < depth);
  }, filtering ? search.visible : undefined), [model, current.overrides, current.mode, filtering, search, depth]);
  const virtual = rows.length > VIRTUAL_THRESHOLD;
  const start = virtual ? Math.max(0, Math.min(rows.length - 1, Math.floor(scrollTop / ROW_HEIGHT)) - OVERSCAN) : 0;
  const end = virtual ? Math.min(rows.length, start + Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2) : rows.length;
  const windowRows = rows.slice(start, end);
  const selected = model.nodes.get(current.selectedId) ?? model.root;
  const expanded = (node: DataNode): boolean => current.overrides.get(node.id) ?? (filtering
    ? search.expanded.has(node.id)
    : current.mode === 'all' || (current.mode === 'depth' && node.depth < depth));

  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [model]);

  function select(node: DataNode, focus = false) {
    setView(previous => ({ ...previous, selectedId: node.id }));
    onSelect?.({ path: node.path, value: node.value, type: node.type });
    if (focus) {
      pendingFocus.current = true;
      const mountedRow = document.getElementById(`${uid}-${node.id}`);
      if (mountedRow) { mountedRow.focus({ preventScroll: true }); pendingFocus.current = false; }
      const index = rows.findIndex(row => row.id === node.id);
      const element = viewport.current;
      if (element && index >= 0) {
        const offset = index * ROW_HEIGHT;
        if (offset < element.scrollTop || offset + ROW_HEIGHT > element.scrollTop + height) {
          element.scrollTop = Math.max(0, offset - height / 2);
          setScrollTop(element.scrollTop);
        }
      }
    }
  }
  function toggle(node: DataNode, open = !expanded(node)) {
    setView(previous => ({ ...previous, overrides: new Map(previous.overrides).set(node.id, open) }));
  }
  function expandAll(open: boolean) {
    setView(previous => ({ ...previous, mode: open ? 'all' : 'none', overrides: filtering
      ? new Map(Array.from(model.nodes.values()).filter(isContainer).map(node => [node.id, open])) : new Map(), selectedId: model.root.id }));
    viewport.current?.scrollTo?.({ top: 0 });
    if (viewport.current) viewport.current.scrollTop = 0;
    setScrollTop(0);
  }
  function changeSearch(value: string) {
    setQuery(value);
    setView(previous => ({ ...previous, overrides: new Map(), selectedId: model.root.id }));
    if (viewport.current) viewport.current.scrollTop = 0;
    setScrollTop(0);
  }
  async function copy(kind: CopyKind, node = selected) {
    if (copying) return;
    setCopying(true);
    let text: string;
    try {
      text = kind === 'path' ? node.path : kind === 'value' && typeof node.value === 'string'
        ? node.value : node.type === 'accessor' || node.type === 'unknown'
          ? JSON.stringify(node.display) : serializeValue(node.value);
      await copyText(text);
      setStatus(kind === 'path' ? 'Path copied.' : kind === 'json' ? 'JSON copied.' : 'Value copied.');
    } catch (error: unknown) {
      const failure = error instanceof Error ? error : new Error('Could not copy this value.');
      setStatus(failure.message);
      onCopyError?.(failure);
      return;
    } finally { setCopying(false); }
    onCopy?.({ text, kind, path: node.path });
  }
  function goToPath() {
    const node = model.nodes.get(pathInput.trim());
    if (!node) { setPathError('Path not found in indexed data.'); return; }
    setPathError('');
    setQuery('');
    const overrides = new Map(current.overrides);
    let parentId = node.parentId;
    while (parentId !== null) {
      overrides.set(parentId, true);
      parentId = model.nodes.get(parentId)?.parentId ?? null;
    }
    setView(previous => ({ ...previous, overrides, selectedId: node.id }));
    onSelect?.({ path: node.path, value: node.value, type: node.type });
    // The new flattened tree is available after React commits the expansion.
    pendingFocus.current = true;
  }
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (pendingFocus.current) {
      const index = rows.findIndex(node => node.id === selected.id);
      if (index >= 0) {
        const offset = index * ROW_HEIGHT;
        if (offset < element.scrollTop || offset + ROW_HEIGHT > element.scrollTop + height) {
          element.scrollTop = Math.max(0, offset - height / 2);
          setScrollTop(element.scrollTop);
        }
        const row = document.getElementById(`${uid}-${selected.id}`);
        if (row) { row.focus({ preventScroll: true }); pendingFocus.current = false; }
      }
    }
  }, [rows, selected.id, height, uid, start, end]);

  function keyDown(event: KeyboardEvent<HTMLDivElement>, node: DataNode) {
    // Nested actions keep their own keyboard behavior.
    if (event.target !== event.currentTarget) return;
    const index = rows.findIndex(row => row.id === node.id);
    let next: DataNode | undefined;
    switch (event.key) {
      case 'ArrowDown': next = rows[index + 1]; break;
      case 'ArrowUp': next = rows[index - 1]; break;
      case 'Home': next = rows[0]; break;
      case 'End': next = rows[rows.length - 1]; break;
      case 'ArrowRight':
        if (node.children.length && !expanded(node)) toggle(node, true);
        else if (node.children.length) next = rows[index + 1];
        break;
      case 'ArrowLeft':
        if (node.children.length && expanded(node)) toggle(node, false);
        else if (node.parentId) next = model.nodes.get(node.parentId);
        break;
      case 'Enter': case ' ':
        if (node.children.length) toggle(node);
        else setDetails(previous => !previous);
        break;
      default: return;
    }
    event.preventDefault();
    if (next) select(next, true);
  }

  const visibleSelection = windowRows.some(node => node.id === selected.id);
  const detailText = typeof selected.value === 'string' ? selected.value : selected.display;
  return <section className={`jg-inspector${className ? ` ${className}` : ''}`} style={style} data-theme={theme}>
    <div className="jg-toolbar">
      {searchable ? <div className="jg-search">
        <Icon name="search" />
        <input aria-label="Search JSON" placeholder="Search keys, values, or paths…" value={query} onChange={event => changeSearch(event.target.value)} />
        {query && <button type="button" className="jg-icon-button" aria-label="Clear search" onClick={() => changeSearch('')}><Icon name="close" /></button>}
      </div> : <span className="jg-toolbar-label">Structured data</span>}
      <div className="jg-toolbar-actions">
        <button type="button" className="jg-icon-button" aria-label="Expand all" title="Expand all" onClick={() => expandAll(true)}><Icon name="expand" /></button>
        <button type="button" className="jg-icon-button" aria-label="Collapse all" title="Collapse all" onClick={() => expandAll(false)}><Icon name="collapse" /></button>
        {copyable && <button type="button" className="jg-button" onClick={() => { void copy('json', model.root); }} disabled={copying}><Icon name="copy" /><span>Copy JSON</span></button>}
      </div>
    </div>
    {filtering && <div className="jg-search-summary" role="status">{search.matches.size} matching {search.matches.size === 1 ? 'node' : 'nodes'}{query.trim() !== effectiveQuery ? ' · Searching…' : ''}</div>}
    <div ref={viewport} className="jg-viewport" style={{ maxHeight: height }} role="tree" aria-label={ariaLabel}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
      {rows.length === 0 ? <div className="jg-empty">No matching keys or values.</div> : <div className="jg-tree-content" style={virtual ? { height: rows.length * ROW_HEIGHT, position: 'relative' } : undefined}>
        {windowRows.map((node, offset) => {
          const index = start + offset;
          const expandable = node.children.length > 0;
          const siblingNodes = node.parentId ? model.nodes.get(node.parentId)?.children : undefined;
          const rowStyle: CSSProperties = {
            paddingInlineStart: `calc(min(${node.depth}, var(--jg-indent-levels, 12)) * 18px + 10px)`,
            ...(virtual ? { position: 'absolute', top: index * ROW_HEIGHT, insetInlineEnd: 0, insetInlineStart: 0 } : {})
          };
          return <div key={node.id} id={`${uid}-${node.id}`} role="treeitem" aria-level={node.depth + 1}
            aria-expanded={expandable ? expanded(node) : undefined} aria-selected={selected.id === node.id}
            aria-posinset={siblingNodes ? siblingNodes.indexOf(node) + 1 : 1} aria-setsize={siblingNodes?.length ?? 1}
            tabIndex={selected.id === node.id || (!visibleSelection && index === start) ? 0 : -1}
            className={`jg-row${selected.id === node.id ? ' jg-selected' : ''}${search.matches.has(node.id) ? ' jg-match' : ''}`}
            style={rowStyle} data-path={node.path} onKeyDown={event => keyDown(event, node)}
            onClick={() => select(node)} onFocus={event => { if (event.target === event.currentTarget && selected.id !== node.id) select(node); }}>
            <span className="jg-line-number" aria-hidden="true">{index + 1}</span>
            {expandable ? <button type="button" tabIndex={-1} className={`jg-toggle${expanded(node) ? ' jg-open' : ''}`}
              aria-label={`${expanded(node) ? 'Collapse' : 'Expand'} ${node.path}`} onClick={event => { event.stopPropagation(); select(node, true); toggle(node); }}><Icon name="chevron" /></button>
              : <span className="jg-toggle-spacer" />}
            <span className="jg-key" title={node.key}><Highlight text={node.key} query={effectiveQuery} /></span>
            <span className="jg-colon" aria-hidden="true">:</span>
            <NodeValue node={node} query={effectiveQuery} limit={limit} onDetails={() => { select(node); setDetails(true); }} />
            {showTypes && <span className={`jg-type jg-type-${node.type}`}>{node.type}</span>}
            {copyable && <button type="button" tabIndex={-1} className="jg-icon-button jg-row-copy" aria-label={`Copy value at ${node.path}`}
              disabled={copying} onClick={event => { event.stopPropagation(); void copy('value', node); }}><Icon name="copy" /></button>}
          </div>;
        })}
      </div>}
    </div>
    {model.warnings.length > 0 && <div className="jg-warning" role="status">{model.warnings.join(' ')}</div>}
    <div className="jg-footer">
      <span className="jg-selected-path" title={selected.path}>{selected.path}</span>
      <span className="jg-count">{rows.length.toLocaleString('en-US')} visible · {model.nodes.size.toLocaleString('en-US')} indexed</span>
      <div className="jg-footer-actions">
        <button type="button" className="jg-text-button" aria-expanded={details} onClick={() => setDetails(previous => !previous)}>Details</button>
        {copyable && <button type="button" className="jg-icon-button" aria-label="Copy selected path" title="Copy selected path" disabled={copying} onClick={() => { void copy('path'); }}><Icon name="link" /></button>}
      </div>
    </div>
    <form className="jg-path-form" onSubmit={event => { event.preventDefault(); goToPath(); }}>
      <label htmlFor={`${uid}-path`}>Go to path</label>
      <input id={`${uid}-path`} value={pathInput} onChange={event => { setPathInput(event.target.value); setPathError(''); }} placeholder="$.customer.email" spellCheck={false} aria-invalid={Boolean(pathError)} aria-describedby={pathError ? `${uid}-path-error` : undefined} />
      <button type="submit" className="jg-icon-button" aria-label="Navigate to path"><Icon name="arrow" /></button>
    </form>
    {pathError && <div id={`${uid}-path-error`} className="jg-warning" role="alert">{pathError}</div>}
    {details && <div className="jg-details">
      <div className="jg-detail-heading"><span>{selected.type} · {selected.path}</span>{copyable && <button type="button" className="jg-text-button" disabled={copying} onClick={() => { void copy('value'); }}>Copy value</button>}</div>
      <pre>{detailText}</pre>
    </div>}
    <div className="jg-sr-only" role="status" aria-live="polite">{status}</div>
    {status && <div className="jg-copy-status">{status}</div>}
  </section>;
}

function NodeValue({ node, query, limit, onDetails }: { node: DataNode; query: string; limit: number; onDetails: () => void }) {
  const raw = typeof node.value === 'string' ? node.value : node.display;
  const long = raw.length > limit;
  let text = node.display;
  if (long) {
    const found = query ? raw.toLowerCase().indexOf(query.toLowerCase()) : -1;
    const start = found > limit ? Math.max(0, found - Math.floor(limit / 3)) : 0;
    text = `${start > 0 ? '…' : ''}${raw.slice(start, start + limit)}${start + limit < raw.length ? '…' : ''}`;
    if (typeof node.value === 'string') text = `"${text}"`;
  }
  const content = <Highlight text={text} query={query} />;
  return <span className={`jg-value jg-value-${node.type}`}>
    <span className="jg-value-text">{node.type === 'url' && !long ? <a href={raw} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{content}</a> : content}</span>
    {long && <button type="button" className="jg-text-button jg-full-value" onClick={event => { event.stopPropagation(); onDetails(); }}>Full value</button>}
    {node.truncated && <span className="jg-truncated"> · limited</span>}
  </span>;
}

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const fragments: ReactNode[] = [];
  let cursor = 0;
  let found = lower.indexOf(needle);
  while (found !== -1) {
    fragments.push(text.slice(cursor, found), <mark key={found}>{text.slice(found, found + query.length)}</mark>);
    cursor = found + query.length;
    found = lower.indexOf(needle, cursor);
  }
  fragments.push(text.slice(cursor));
  return fragments;
}
