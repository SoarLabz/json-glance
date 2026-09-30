export interface Example {
  id: string;
  name: string;
  description: string;
  label: string;
  data: unknown;
  note?: string;
  maxNodes?: number;
}

const simple = {
  name: 'json-glance',
  version: '1.0.0',
  description: 'A closer look at your data.',
  public: true,
  features: ['Search', 'Copy', 'Explore'],
  author: { name: 'SoarLabz', location: 'Brazil' },
  dependencies: null,
};

const transaction = {
  id: 'txn_demo_8f21c4',
  status: 'completed',
  amount: 249.9,
  currency: 'BRL',
  created_at: '2026-09-30T12:24:08.000Z',
  payment: {
    method: 'pix',
    installments: 1,
    reference: 'payment_demo_42',
    processed_at: '2026-09-30T12:24:12.000Z',
  },
  customer: {
    id: 'cus_example_01',
    name: 'Alex Example',
    email: 'alex@example.com',
    verified: true,
  },
  items: [
    { sku: 'TICKET-01', name: 'Design systems workshop', quantity: 1, price: 199.9 },
    { sku: 'KIT-02', name: 'Workshop materials', quantity: 1, price: 50 },
  ],
  metadata: {
    source: 'playground',
    campaign: 'community-2026',
    tags: ['digital', 'education'],
    checkout_url: 'https://example.com/checkout/demo',
    note: null,
  },
};

const deepObject: Record<string, unknown> = { level: 0 };
let cursor = deepObject;
for (let index = 1; index <= 20; index += 1) {
  const next: Record<string, unknown> = { level: index, label: `Layer ${index}` };
  cursor.child = next;
  cursor = next;
}
cursor.treasure = 'You reached the deepest layer.';

const longText = 'Structured data deserves a little clarity. Explore the shape, find the value, and keep the context. ';
const longStrings = {
  short: 'Easy to read.',
  paragraph: longText.repeat(8),
  multiline: 'Line one: a small beginning.\nLine two: a new perspective.\nLine three: the complete picture.',
  unicode: 'Olá, mundo! · 日本語 · العربية · 🚀✨ · café',
  escaped: 'Quotes: "hello". A tab:\t. A backslash: \\. A newline follows:\nDone.',
  unbroken: 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(36),
};

const circular: Record<string, unknown> = {
  title: 'A safe look at JavaScript values',
  ordinary: { visible: true, value: 42 },
};
circular.self = circular;
Object.defineProperty(circular, 'secretGetter', {
  enumerable: true,
  get(): never {
    throw new Error('This accessor must never be evaluated by the inspector.');
  },
});

const performance = Array.from({ length: 3000 }, (_, index) => ({
  id: index + 1,
  name: `Record ${String(index + 1).padStart(4, '0')}`,
  active: index % 3 !== 0,
  score: Math.round(((index * 13) % 1000) / 10),
  region: ['Americas', 'Europe', 'Asia Pacific'][index % 3],
  metadata: { group: index % 12, verified: index % 2 === 0 },
}));

export const examples: readonly Example[] = [
  {
    id: 'simple',
    name: 'Simple JSON',
    label: 'The essentials',
    description: 'A little of everything. Start with objects, arrays, and everyday values.',
    data: simple,
  },
  {
    id: 'transaction',
    name: 'Transaction metadata',
    label: 'A familiar dashboard',
    description: 'Payment details, customer data, and metadata in one tidy inspector.',
    data: transaction,
    note: 'All records are synthetic. Names, identifiers, and URLs are examples.',
  },
  {
    id: 'deep',
    name: 'Deeply nested object',
    label: '20 layers deep',
    description: 'Follow a single branch through twenty levels of nested objects.',
    data: deepObject,
    note: 'Try searching for “treasure” to find a value without opening each layer.',
  },
  {
    id: 'large-array',
    name: 'Large array',
    label: '1,000 items',
    description: 'A thousand values to explore, search, and copy by their array index.',
    data: Array.from({ length: 1000 }, (_, index) => `Item ${String(index + 1).padStart(4, '0')}`),
  },
  {
    id: 'long-strings',
    name: 'Long strings',
    label: 'Room for the details',
    description: 'Long paragraphs, unbroken text, escaped characters, and multilingual content.',
    data: longStrings,
    note: 'Adjust the string preview limit and open a truncated value to see its full text.',
  },
  {
    id: 'primitives',
    name: 'Primitives & numbers',
    label: 'More than JSON',
    description: 'Booleans, missing values, decimals, special numbers, and JavaScript bigint.',
    data: {
      yes: true,
      no: false,
      nothing: null,
      missing: undefined,
      zero: 0,
      negative: -42,
      decimal: 3.141592653589793,
      scientific: 6.02214076e23,
      not_a_number: Number.NaN,
      positive_infinity: Number.POSITIVE_INFINITY,
      negative_zero: -0,
      large_integer: BigInt('900719925474099312345'),
    },
    note: 'JavaScript values outside JSON are displayed explicitly and copied with documented serialization markers.',
  },
  {
    id: 'empty-values',
    name: 'Empty containers',
    label: 'Nothing left ambiguous',
    description: 'See the difference between an empty object, an empty array, and a missing value.',
    data: { object: {}, array: [], string: '', null_value: null, missing: undefined, nested: { objects: [{}, {}], arrays: [[], []] } },
  },
  {
    id: 'empty-root',
    name: 'Empty root',
    label: 'A fresh start',
    description: 'An empty object is still data. The root remains visible and selectable.',
    data: {},
  },
  {
    id: 'links-dates',
    name: 'URLs & dates',
    label: 'Values with meaning',
    description: 'Web links, ISO timestamps, and native Date instances keep their useful context.',
    data: {
      website: 'https://example.com',
      documentation: 'https://example.com/docs?section=inspector&theme=light',
      created_at: '2026-09-30T12:00:00.000Z',
      date_only: '2026-09-30',
      native_date: new Date('2026-09-30T12:00:00.000Z'),
      invalid_date: new Date('invalid'),
      unsafe_protocol: 'javascript:alert("demo")',
      relative_path: '/docs/getting-started',
    },
    note: 'Only HTTP and HTTPS values become external links. Link clicks open a new tab.',
  },
  {
    id: 'mixed-arrays',
    name: 'Mixed nested arrays',
    label: 'Shapes within shapes',
    description: 'Arrays do not always contain one type. Explore mixed values and nested collections.',
    data: {
      mixed: [1, 'two', true, null, undefined, { six: 6 }, [7, 8], []],
      matrix: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      groups: [{ name: 'Design', people: ['Alex', 'Sam'] }, { name: 'Engineering', people: ['Taylor', 'Jordan'] }],
      unusual_keys: { 'a.b': { 'with spaces': 'A bracket path keeps these keys precise.' }, 'quote"key': 42, '': 'An empty key' },
    },
  },
  {
    id: 'performance',
    name: 'Performance dataset',
    label: '3,000 records · 27,001 nodes',
    description: 'A larger generated dataset for checking navigation, search, and bounded rendering.',
    data: performance,
    maxNodes: 40000,
    note: '3,000 deterministic records, generated locally. Search for “Record 2999” to jump near the end.',
  },
  {
    id: 'diagnostics',
    name: 'Circular & accessor values',
    label: 'Safe inspection',
    description: 'A circular reference and a throwing getter demonstrate defensive inspection.',
    data: circular,
    note: 'The getter throws if called. The inspector displays the accessor without evaluating it.',
  },
  {
    id: 'primitive-root',
    name: 'Primitive root',
    label: 'One value is enough',
    description: 'The root can be a single primitive, with the same search and copy controls.',
    data: 'A closer look at your data.',
  },
  {
    id: 'null-root',
    name: 'Null root',
    label: 'Explicitly empty',
    description: 'A null response is displayed as a meaningful root value.',
    data: null,
  },
];

export const galleryData = {
  status: 'ready',
  count: 3,
  enabled: true,
  owner: { name: 'Alex Example', role: 'Developer' },
};

export const galleryAccountData = {
  profile: galleryData,
  permissions: ['read', 'write'],
  preferences: { locale: 'en', theme: 'auto' },
};
