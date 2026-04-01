export function cleanupTitle(text) {
  const t = (text || '')
    .toString()
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!t) return '';

  let out = t
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/([,.;:!?])([^\s])/g, '$1 $2');

  out = out
    .replace(/([,.;:!?])(\s*\1)+/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\{\s*\}/g, '');

  return out.trim().replace(/\s+/g, ' ');
}

export function tokenizeBySpaces(title) {
  const cleaned = (title || '').toString().replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  return cleaned.split(' ');
}

export function stripEdgePunctuation(word) {
  return (word || '').toString().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function removeSelectedWordIndexes(title, selectedIndexes) {
  const words = tokenizeBySpaces(title);
  if (!words.length) return '';
  const set = new Set(selectedIndexes || []);
  const kept = words.filter((_, idx) => !set.has(idx));
  return cleanupTitle(kept.join(' '));
}

