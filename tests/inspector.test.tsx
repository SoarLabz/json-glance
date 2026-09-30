import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { JsonGlance } from '../src/index.js';

const fixture = { customer: { name: 'Ada', address: { city: 'Recife' } }, flags: [true, null, 0], empty: {}, missing: undefined };
const tree = () => screen.getByRole('tree');
const row = (path: string) => tree().querySelector(`[data-path='${path}']`);

describe('JsonGlance', () => {
  it('shows all JSON types, empty roots, and explicit undefined', () => {
    const view = render(<JsonGlance data={fixture} />);
    expect(within(tree()).getAllByText('null').length).toBeGreaterThan(0);
    expect(within(tree()).getAllByText('undefined')[0]).toBeInTheDocument();
    expect(within(tree()).getByText('{}')).toBeInTheDocument();
    view.rerender(<JsonGlance data={[]} />);
    expect(within(tree()).getByText('[]')).toBeInTheDocument();
    view.rerender(<JsonGlance data={null} />);
    expect(row('$')).toHaveTextContent('null');
  });

  it('honors initial depth and preserves descendant expansion across parent collapse', async () => {
    const user = userEvent.setup();
    render(<JsonGlance data={fixture} defaultExpandedDepth={1} />);
    expect(row('$.customer')).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Expand $.customer' }));
    await user.click(screen.getByRole('button', { name: 'Expand $.customer.address' }));
    expect(row('$.customer.address.city')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse $.customer' }));
    await user.click(screen.getByRole('button', { name: 'Expand $.customer' }));
    expect(row('$.customer.address.city')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(within(tree()).getAllByRole('treeitem')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(row('$.customer.address.city')).toBeInTheDocument();
  });

  it('finds collapsed values, highlights results and excludes unrelated branches', async () => {
    const user = userEvent.setup();
    render(<JsonGlance data={fixture} defaultExpandedDepth={0} />);
    await user.type(screen.getByRole('textbox', { name: 'Search JSON' }), 'recife');
    expect(row('$.customer.address.city')).toBeInTheDocument();
    expect(row('$.flags')).not.toBeInTheDocument();
    expect(tree().querySelector('mark')).toHaveTextContent('Recife');
    await user.clear(screen.getByRole('textbox', { name: 'Search JSON' }));
    await user.type(screen.getByRole('textbox', { name: 'Search JSON' }), 'not-found');
    expect(within(tree()).getByText('No matching keys or values.')).toBeInTheDocument();
  });

  it('copies whole JSON, selected raw value and escaped path, and reports failures honestly', async () => {
    const user = userEvent.setup();
    const copyText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    const onCopy = vi.fn();
    const onCopyError = vi.fn();
    render(<JsonGlance data={{ 'a.b': 'hello' }} copyText={copyText} onCopy={onCopy} onCopyError={onCopyError} />);
    await user.click(screen.getByRole('button', { name: 'Copy JSON' }));
    expect(copyText).toHaveBeenLastCalledWith('{\n  "a.b": "hello"\n}');
    const primitive = Array.from(tree().querySelectorAll('[data-path]')).find(element => element.getAttribute('data-path') === '$["a.b"]');
    expect(primitive).toBeInTheDocument();
    if (!primitive) throw new Error('Missing row');
    await user.click(primitive);
    await user.click(screen.getByRole('button', { name: 'Copy selected path' }));
    expect(copyText).toHaveBeenLastCalledWith('$["a.b"]');
    await user.click(screen.getByRole('button', { name: 'Copy value at $["a.b"]' }));
    expect(copyText).toHaveBeenLastCalledWith('hello');
    copyText.mockRejectedValueOnce(new Error('Clipboard denied.'));
    await user.click(screen.getByRole('button', { name: 'Copy JSON' }));
    expect(onCopy).toHaveBeenCalledTimes(3);
    expect(onCopyError).toHaveBeenCalledOnce();
    expect(screen.getAllByText('Clipboard denied.').length).toBeGreaterThan(0);
  });

  it('jumps to indexed JSONPaths, expands ancestors, and handles unknown paths', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<JsonGlance data={fixture} defaultExpandedDepth={0} onSelect={onSelect} />);
    await user.type(screen.getByLabelText('Go to path'), '$.customer.address.city');
    await user.click(screen.getByRole('button', { name: 'Navigate to path' }));
    expect(row('$.customer.address.city')).toHaveAttribute('aria-selected', 'true');
    expect(onSelect).toHaveBeenLastCalledWith({ path: '$.customer.address.city', type: 'string', value: 'Recife' });
    await user.clear(screen.getByLabelText('Go to path'));
    await user.type(screen.getByLabelText('Go to path'), '$.absent');
    await user.click(screen.getByRole('button', { name: 'Navigate to path' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Path not found');
  });

  it('supports keyboard navigation and resets replacement data state', async () => {
    const user = userEvent.setup();
    const view = render(<JsonGlance data={fixture} defaultExpandedDepth={1} />);
    const root = row('$');
    if (!(root instanceof HTMLElement)) throw new Error('Missing root');
    root.focus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(row('$.customer')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    expect(row('$.customer.name')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(row('$.customer')).toHaveFocus();
    view.rerender(<JsonGlance data={{ newValue: 12 }} defaultExpandedDepth={1} />);
    expect(row('$')).toHaveAttribute('aria-selected', 'true');
    expect(row('$.customer')).not.toBeInTheDocument();
    expect(row('$.newValue')).toBeInTheDocument();
  });

  it('previews long values while preserving full string in details and search', async () => {
    const user = userEvent.setup();
    const value = 'x'.repeat(300) + 'needle' + 'y'.repeat(200);
    render(<JsonGlance data={{ long: value }} stringLimit={32} />);
    expect(tree()).not.toHaveTextContent(value);
    await user.click(screen.getByRole('button', { name: 'Full value' }));
    expect(screen.getByText(value)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search JSON' }), 'needle');
    expect(tree().querySelector('mark')).toHaveTextContent('needle');
  });

  it('virtualizes large expanded trees and reveals distant path selections', async () => {
    const user = userEvent.setup();
    const data = Array.from({ length: 3000 }, (_, index) => ({ index, label: `item-${index}` }));
    render(<JsonGlance data={data} defaultExpandedDepth={3} maxHeight={320} />);
    expect(within(tree()).getAllByRole('treeitem').length).toBeLessThan(50);
    fireEvent.scroll(tree(), { target: { scrollTop: 10000 } });
    expect(within(tree()).getAllByRole('treeitem').length).toBeLessThan(50);
    fireEvent.change(screen.getByRole('textbox', { name: 'Go to path' }), { target: { value: '$[2999].label' } });
    await user.click(screen.getByRole('button', { name: 'Navigate to path' }));
    expect(row('$[2999].label')).toHaveAttribute('aria-selected', 'true');
    expect(row('$[2999].label')).toHaveFocus();
  });

  it('keeps URLs safe, shows dates, and never interprets markup', () => {
    render(<JsonGlance data={{ website: 'https://example.com', date: '2026-09-30', unsafe: 'javascript:alert(1)', markup: '<img src=x onerror=alert(1)>' }} />);
    expect(within(tree()).getByRole('link')).toHaveAttribute('href', 'https://example.com');
    expect(row('$.date')).toHaveTextContent('date');
    expect(tree().querySelector('img')).toBeNull();
    expect(within(tree()).getAllByRole('link')).toHaveLength(1);
  });

  it('omits optional search, type labels and clipboard actions', () => {
    render(<JsonGlance data={{ number: 12 }} searchable={false} copyable={false} showTypes={false} />);
    expect(screen.queryByRole('textbox', { name: 'Search JSON' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
    expect(tree().querySelector('.jg-type')).toBeNull();
  });

  it('renders safely on the server with circular values and getters', () => {
    const data: Record<string, unknown> = {};
    data['self'] = data;
    Object.defineProperty(data, 'getter', { enumerable: true, get() { throw new Error('Must not execute'); } });
    const html = renderToString(<JsonGlance data={data} />);
    expect(html).toContain('Circular');
    expect(html).toContain('Getter');
  });
});
