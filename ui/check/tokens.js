// The few tokens the check pane needs as numbers (stagger delays, the silence window, the
// listener's geometry). Everything else is consumed by check.css as custom properties.
export function readCheckTokens() {
  const style = getComputedStyle(document.documentElement);
  const num = (name) => parseFloat(style.getPropertyValue(name));
  return {
    dFast: num('--d-fast'),
    dBase: num('--d-base'),
    dDetail: num('--d-detail'),
    dSilence: num('--d-silence'),
    dLock: num('--d-lock'),
    tRead: num('--t-read'),
    spectrum: num('--spectrum'),
    gap: num('--gap'),
    hairline: num('--hairline'),
    active: style.getPropertyValue('--active').trim(),
  };
}

// Text with `backticks` becomes text with <code> spans. Everything else is text, never HTML.
export function inlineCode(el, text) {
  el.textContent = '';
  const parts = String(text).split('`');
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2) {
      const code = document.createElement('code');
      code.textContent = part;
      el.appendChild(code);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  });
}

// Add a class one frame after the element exists, so its entrance transition runs.
export function reveal(el, cls = 'shown') {
  void el.offsetWidth;
  el.classList.add(cls);
}
