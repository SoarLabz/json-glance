/** Clipboard access happens only after a user action. Failure never reports success. */
export async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable in this environment.');
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the legacy browser fallback. */ }
  }
  const previousFocus = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  try {
    input.select();
    if (typeof document.execCommand !== 'function' || !document.execCommand('copy')) {
      throw new Error('Could not copy. Allow clipboard access or provide copyText.');
    }
  } finally {
    input.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
}
