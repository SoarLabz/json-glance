import { useState } from 'react';
import { JsonGlance } from 'json-glance';
import type { Selection } from 'json-glance';
import { examples, galleryAccountData, galleryData } from './examples';

type Theme = 'light' | 'dark' | 'auto';
type IconName = 'loupe' | 'arrow' | 'code' | 'sliders' | 'check' | 'layers' | 'external' | 'circle';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const shapes = {
    loupe: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M8 8h5M8 11h3" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" /></>,
    sliders: <><path d="M4 7h9m4 0h3M4 17h3m4 0h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    layers: <><path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></>,
    external: <><path d="M14 3h7v7m0-7L11 13M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>,
    circle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
  };

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="config-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span className="toggle-track" aria-hidden="true"><span /></span>
    </label>
  );
}

function selectedPreview(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array · ${value.length.toLocaleString()} items`;
  if (typeof value === 'object') return 'Object';
  if (typeof value === 'string') return value.length > 100 ? `${value.slice(0, 100)}…` : value;
  if (typeof value === 'function') return 'Function';
  return String(value);
}

export function App() {
  const [exampleId, setExampleId] = useState('transaction');
  const [theme, setTheme] = useState<Theme>('light');
  const [depth, setDepth] = useState(2);
  const [stringLimit, setStringLimit] = useState(160);
  const [maxHeight, setMaxHeight] = useState(480);
  const [minimal, setMinimal] = useState(false);
  const [searchable, setSearchable] = useState(true);
  const [copyable, setCopyable] = useState(true);
  const [showTypes, setShowTypes] = useState(true);
  const [rootLabel, setRootLabel] = useState('metadata');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [resetRevision, setResetRevision] = useState(0);
  const example = examples.find((item) => item.id === exampleId) ?? examples[0];

  if (!example) return null;

  const code = `import { JsonGlance } from 'json-glance';\nimport 'json-glance/styles.css';\n\n<JsonGlance\n  data={data}\n  rootLabel={${JSON.stringify(rootLabel || 'root')}}\n  theme="${theme}"\n  defaultExpandedDepth={${depth}}\n  maxHeight={${maxHeight}}\n  stringLimit={${stringLimit}}\n  minimal={${minimal}}\n  searchable={${searchable}}\n  copyable={${copyable}}\n  showTypes={${showTypes}}${example.maxNodes ? `\n  maxNodes={${example.maxNodes}}` : ''}\n  onSelect={({ path, value, type }) => {\n    console.log(path, value, type);\n  }}\n/>`;

  function resetSettings() {
    setTheme('light');
    setDepth(2);
    setStringLimit(160);
    setMaxHeight(480);
    setMinimal(false);
    setSearchable(true);
    setCopyable(true);
    setShowTypes(true);
    setRootLabel('metadata');
    setCopyStatus('idle');
    setSelected(null);
    setResetRevision((revision) => revision + 1);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <>
      <a className="skip-link" href="#playground">Skip to playground</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="json-glance home">
          <span className="brand-mark"><Icon name="loupe" size={24} /></span>
          <span>json<span className="brand-hyphen">-</span>glance</span>
        </a>
        <nav className="header-nav" aria-label="Page navigation">
          <a href="#playground" className="header-active">Playground</a>
          <a href="#variations">Variations</a>
          <a href="#getting-started">Quick start</a>
        </nav>
        <span className="version-badge"><span />v1.0.0</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span /> A small library. A clearer picture.</p>
            <h1 id="hero-title">A closer look at <span>your data.</span></h1>
            <p className="hero-description">A clean, thoughtful inspector for JSON and structured data.<br className="desktop-break" /> Built for the details that make your dashboard work.</p>
            <div className="hero-facts">
              <span><Icon name="check" size={14} /> React + TypeScript</span>
              <span><Icon name="check" size={14} /> No runtime dependencies</span>
              <span><Icon name="check" size={14} /> MIT licensed</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-art-label">STRUCTURE, MADE VISIBLE</span>
            <div className="art-code"><span className="art-brace">{'{'}</span><span><i>"clarity"</i>: <b>true</b>,</span><span><i>"details"</i>: [<em>"every layer"</em>]</span><span className="art-brace">{'}'}</span></div>
            <div className="art-loupe"><Icon name="loupe" size={45} /></div>
          </div>
        </section>

        <section id="playground" className="playground-section" aria-labelledby="playground-title">
          <div className="section-heading">
            <div><p className="eyebrow subtle">INTERACTIVE PLAYGROUND</p><h2 id="playground-title">See what’s inside.</h2></div>
            <p>Pick a dataset. Make it your own.</p>
          </div>

          <div className="workspace">
            <aside className="examples-panel" aria-labelledby="examples-title">
              <div className="panel-heading"><h3 id="examples-title">Examples</h3><span>{examples.length}</span></div>
              <nav className="example-list" aria-label="Choose a dataset">
                {examples.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`example-button${exampleId === item.id ? ' is-selected' : ''}`}
                    aria-current={exampleId === item.id ? 'true' : undefined}
                    onClick={() => { setExampleId(item.id); setSelected(null); setCopyStatus('idle'); }}
                  >
                    <span className="example-number">{String(index + 1).padStart(2, '0')}</span>
                    <span><strong>{item.name}</strong><small>{item.label}</small></span>
                    {exampleId === item.id && <span className="selected-dot" />}
                  </button>
                ))}
              </nav>
              <div className="examples-footnote"><Icon name="circle" size={15} /><p>Made-up data.<br />Real component behavior.</p></div>
            </aside>

            <div className="specimen-panel">
              <div className="specimen-heading">
                <div><span className="specimen-kicker">LIVE EXAMPLE</span><h3>{example.name}</h3><p>{example.description}</p></div>
                <span className="live-badge"><span /> Live</span>
              </div>
              <div className="specimen-tabs" role="tablist" aria-label="Example view">
                <button id="preview-tab" type="button" role="tab" aria-selected={activeTab === 'preview'} aria-controls="preview-panel" tabIndex={activeTab === 'preview' ? 0 : -1} className={activeTab === 'preview' ? 'is-active' : ''} onClick={() => setActiveTab('preview')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { setActiveTab('code'); document.getElementById('code-tab')?.focus(); } }}><Icon name="layers" size={16} /> Inspector</button>
                <button id="code-tab" type="button" role="tab" aria-selected={activeTab === 'code'} aria-controls="code-panel" tabIndex={activeTab === 'code' ? 0 : -1} className={activeTab === 'code' ? 'is-active' : ''} onClick={() => setActiveTab('code')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { setActiveTab('preview'); document.getElementById('preview-tab')?.focus(); } }}><Icon name="code" size={16} /> React code</button>
                <span className="package-import">imported from package</span>
              </div>
              <div className="inspector-stage" id="preview-panel" role="tabpanel" aria-labelledby="preview-tab" hidden={activeTab !== 'preview'}>
                <JsonGlance
                  key={`${example.id}-${depth}-${resetRevision}`}
                  data={example.data}
                  rootLabel={rootLabel || 'root'}
                  theme={theme}
                  defaultExpandedDepth={depth}
                  stringLimit={stringLimit}
                  maxHeight={maxHeight}
                  maxDepth={64}
                  maxNodes={example.maxNodes ?? 50000}
                  minimal={minimal}
                  searchable={searchable}
                  copyable={copyable}
                  showTypes={showTypes}
                  onSelect={(selection) => setSelected(selection)}
                />
              </div>
              <div className="usage-code" id="code-panel" role="tabpanel" aria-labelledby="code-tab" hidden={activeTab !== 'code'}>
                <div className="code-heading"><span>App.tsx</span><button type="button" onClick={() => { void copyCode(); }} aria-live="polite">{copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy unavailable' : 'Copy code'}</button></div>
                <pre><code>{code}</code></pre>
                <p>These props update as you change the controls.</p>
              </div>
              <div className="selection-bar" aria-live="polite" aria-atomic="true">
                <span className="selection-label">SELECTED PATH</span>
                {selected ? <><code title={selected.path}>{selected.path}</code><span className="selection-type">{selected.type}</span><span className="selection-value" title={selectedPreview(selected.value)}>{selectedPreview(selected.value)}</span></> : <span className="selection-placeholder">Select any row to explore its path and value.</span>}
              </div>
              {example.note && <p className="dataset-note"><Icon name="circle" size={15} />{example.note}</p>}
            </div>

            <aside className="configuration-panel" aria-labelledby="configuration-title">
              <div className="panel-heading"><h3 id="configuration-title"><Icon name="sliders" size={16} /> Configuration</h3><button type="button" className="reset-button" onClick={resetSettings}>Reset</button></div>
              <div className="config-content">
                <fieldset className="theme-control"><legend>Theme</legend><div className="segmented-control">{(['light', 'dark', 'auto'] as const).map((value) => <label key={value} className={theme === value ? 'is-active' : ''}><input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} /><span>{value.charAt(0).toUpperCase() + value.slice(1)}</span></label>)}</div></fieldset>
                <label className="config-field"><span>Root label</span><input type="text" value={rootLabel} maxLength={40} onChange={(event) => setRootLabel(event.currentTarget.value)} placeholder="root" /></label>
                <label className="config-field" htmlFor="initial-depth"><span>Initial depth <output>{depth}</output></span><input id="initial-depth" aria-label="Initial depth" type="range" min="0" max="6" step="1" value={depth} onChange={(event) => setDepth(Number(event.currentTarget.value))} /><small>Open {depth === 0 ? 'the root only when clicked' : `${depth} ${depth === 1 ? 'level' : 'levels'} on load`}.</small></label>
                <label className="config-field" htmlFor="string-preview"><span>String preview <output>{stringLimit} chars</output></span><select id="string-preview" aria-label="String preview" value={stringLimit} onChange={(event) => setStringLimit(Number(event.currentTarget.value))}><option value={80}>80 characters</option><option value={160}>160 characters</option><option value={320}>320 characters</option><option value={640}>640 characters</option></select></label>
                <label className="config-field" htmlFor="inspector-height"><span>Inspector height <output>{maxHeight} px</output></span><input id="inspector-height" aria-label="Inspector height" type="range" min="280" max="680" step="40" value={maxHeight} onChange={(event) => setMaxHeight(Number(event.currentTarget.value))} /></label>
                <div className="toggle-group">
                  <Toggle label="Tree only" description="Hide surrounding controls" checked={minimal} onChange={setMinimal} />
                  <Toggle label="Search" description="Find keys and values" checked={searchable} onChange={setSearchable} />
                  <Toggle label="Copy actions" description="Values, paths, and JSON" checked={copyable} onChange={setCopyable} />
                  <Toggle label="Type labels" description="A little extra context" checked={showTypes} onChange={setShowTypes} />
                </div>
                <div className="config-tip"><span className="tip-icon"><Icon name="code" size={18} /></span><p>Like this setup?<br /><button type="button" onClick={() => { setActiveTab('code'); document.getElementById('code-tab')?.focus(); }}>Get the React code <Icon name="arrow" size={14} /></button></p></div>
              </div>
            </aside>
          </div>
        </section>

        <section id="variations" className="variations-section" aria-labelledby="variations-title">
          <div className="section-heading"><div><p className="eyebrow subtle">A GOOD FIT, EVERYWHERE</p><h2 id="variations-title">Your interface. Your inspector.</h2></div><p>One component, a few different perspectives.</p></div>
          <div className="variation-grid">
            <article className="variation-card"><div className="variation-caption"><span className="variation-index">01</span><div><h3>Tree only</h3><p>Explore the data without surrounding controls.</p></div></div><JsonGlance data={galleryData} defaultExpandedDepth={1} minimal rootLabel="response" theme="light" maxHeight={220} /><code>minimal</code></article>
            <article className="variation-card"><div className="variation-caption"><span className="variation-index">02</span><div><h3>After hours</h3><p>A native dark theme for developer tools.</p></div></div><JsonGlance data={galleryData} defaultExpandedDepth={1} searchable={false} rootLabel="response" theme="dark" maxHeight={220} /><code>theme="dark"</code></article>
            <article className="variation-card"><div className="variation-caption"><span className="variation-index">03</span><div><h3>Start with the shape</h3><p>Let people choose what to explore.</p></div></div><JsonGlance data={galleryAccountData} defaultExpandedDepth={0} searchable={false} rootLabel="account" theme="light" maxHeight={220} /><code>defaultExpandedDepth={'{0}'}</code></article>
          </div>
        </section>

        <section id="getting-started" className="getting-started" aria-labelledby="getting-started-title">
          <div><p className="eyebrow subtle">SMALL SURFACE. USEFUL DETAILS.</p><h2 id="getting-started-title">Ready for your next dashboard.</h2><p>Bring your data. The component handles the view.</p></div>
          <div className="install-command"><span>$</span><code>npm install json-glance</code><Icon name="arrow" size={20} /></div>
        </section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#"><Icon name="loupe" size={18} /> json-glance</a><span>Made by SoarLabz. Open source, under the MIT license.</span><a href="#playground">Back to playground <Icon name="arrow" size={14} /></a></footer>
    </>
  );
}
