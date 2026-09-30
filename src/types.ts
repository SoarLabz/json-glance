import type { CSSProperties } from 'react';
import type { NodeType } from './model.js';

/** JSON values. The inspector also accepts unknown JavaScript values safely. */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type CopyKind = 'json' | 'value' | 'path';
export interface Selection { path: string; value: unknown; type: NodeType }
export interface CopyEvent { text: string; kind: CopyKind; path: string }

export interface JsonGlanceProps {
  /** Structured data to inspect. Strings are displayed as strings, never parsed. */
  data: unknown;
  /** Open containers at depths less than this value. Root depth is zero. Default: 2. */
  defaultExpandedDepth?: number;
  /** Show key/value/path search. Default: true. */
  searchable?: boolean;
  /** Show only the tree by default, hiding toolbar, footer, and path navigation. Default: false. */
  minimal?: boolean;
  /** Show the search and global actions toolbar. Default: !minimal. */
  showToolbar?: boolean;
  /** Show the selected path, node counts, and detail actions footer. Default: !minimal. */
  showFooter?: boolean;
  /** Show the exact-path navigation form. Default: !minimal. */
  showPathNavigation?: boolean;
  /** Enable copy JSON, selected value, and selected path. Default: true. */
  copyable?: boolean;
  /** Show type labels alongside syntax colors. Default: true. */
  showTypes?: boolean;
  /** Display name of the root row. Paths always start with $. Default: root. */
  rootLabel?: string;
  /** Color theme. Auto follows the OS preference. Default: auto. */
  theme?: 'light' | 'dark' | 'auto';
  /** Maximum tree viewport height in pixels. Default: 420. Minimum: 96. */
  maxHeight?: number;
  /** Character count before preview truncation. Full value is in the detail panel. Default: 160. */
  stringLimit?: number;
  /** Maximum indexed nodes, including root. Default: 50000. */
  maxNodes?: number;
  /** Maximum inspected depth. Root depth is zero. Default: 64. */
  maxDepth?: number;
  /** Accessible name of the data tree. Default: JSON data. */
  ariaLabel?: string;
  /** Classes on the outer inspector. All library styles use the jg- prefix. */
  className?: string;
  /** Inline styles, including custom CSS variables through a consumer stylesheet. */
  style?: CSSProperties;
  /** Called when a row or path is selected. */
  onSelect?: (selection: Selection) => void;
  /** Called after a successful clipboard operation. */
  onCopy?: (event: CopyEvent) => void;
  /** Called on clipboard or serialization failure. Also shown in an accessible status. */
  onCopyError?: (error: Error) => void;
  /** Override the browser clipboard writer (for desktop hosts or custom integrations). */
  copyText?: (text: string) => Promise<void>;
}
