import { reveal } from './tokens.js';

// Renders the `check` and `skip` line lists from the daemon. Line 1 is the section label,
// line 2 the path, the rest metadata. Lines land --d-fast apart. On `Assigned to:` the name
// is the one thing in the header that carries --text: a named human, on the hook.
export function createHeader(region, t) {
  function render(lines) {
    region.textContent = '';
    lines.forEach((line, i) => {
      const el = document.createElement('div');
      el.className = i === 0 ? 'h-label' : i === 1 ? 'h-path' : 'h-meta';
      const assigned = line.match(/^(Assigned to:\s*)(.+)$/);
      if (assigned) {
        el.appendChild(document.createTextNode(assigned[1]));
        const name = document.createElement('span');
        name.className = 'h-name';
        name.textContent = assigned[2];
        el.appendChild(name);
      } else {
        el.textContent = line;
      }
      el.style.transitionDelay = `${i * t.dFast}ms`;
      region.appendChild(el);
    });
    for (const el of region.children) reveal(el);
    return lines.length * t.dFast;
  }

  function clear() {
    region.textContent = '';
  }

  function snapshot() {
    return [...region.children].map((el) => el.textContent);
  }

  return { render, clear, snapshot };
}
