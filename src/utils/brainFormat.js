// Formatting for Dispatch Brain data (ELD check, search, assistant)

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

/**
 * The assistant's small Markdown: links (https and tg only), bare URLs, **bold**, `code`,
 * "- " lists and line breaks. Everything else is escaped, so the result is safe for v-html.
 */
export function renderMarkdown(text) {
  const blocks = [];
  let list = null;
  for (const raw of String(text ?? '').split('\n')) {
    const item = raw.match(/^\s*[-*•]\s+(.*)$/);
    if (item) {
      if (!list) { list = []; blocks.push({ list }); }
      list.push(inline(item[1]));
      continue;
    }
    list = null;
    blocks.push({ line: inline(raw) });
  }
  return blocks
    .map(b => (b.list ? `<ul>${b.list.map(li => `<li>${li}</li>`).join('')}</ul>` : `${b.line}<br>`))
    .join('')
    .replace(/(<br>)+$/, '');
}

function inline(s) {
  let h = escapeHtml(s);
  h = h.replace(/\[([^\]]+)\]\(((?:https|tg):[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/(^|[\s(])(https:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return h;
}

// "KARIMOV RUSTAM" -> "Karimov Rustam"
export function niceName(name) {
  return String(name || '').toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

// How the ELD writes "nothing": Bobtail (no trailer) and na (no shipping docs)
export function plainValue(field, v) {
  if (v == null || v === '') return 'none';
  if (field === 'shipping_docs' && String(v).toLowerCase() === 'na') return 'none (na)';
  if (field === 'trailer' && String(v).toLowerCase() === 'bobtail') return 'Bobtail (no trailer)';
  return String(v);
}

// What to write to the ELD for "nothing"
export function eldEmptyValue(field) {
  return field === 'trailer' ? 'Bobtail' : 'na';
}

export const CARD_LABELS = {
  pickup: 'pickup', delivery: 'delivery', trailer: 'trailer', offer: 'load offer', cancelled: 'cancelled load'
};
export const cardLabel = (c) => CARD_LABELS[c] || c || 'message';
