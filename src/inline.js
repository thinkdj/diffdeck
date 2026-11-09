// The little markdown a repo description takes: *bold*, _italic_, [text](url) and bare URLs. Nothing else.
// inline(text) returns tokens, never HTML: strings, { b: tokens }, { i: tokens } or { a: href, kids: tokens }.
// The page turns them into React elements, so no markup in a description can reach the DOM as markup.
// Links must be http or https; anything else (javascript:, data:, a broken URL) stays plain text.

// [label](url) | bare URL (trailing punctuation left out) | *bold* | _italic_. Markers must hug the text and sit at
// word edges, so snake_case_names and 2*3*4 stay as they are.
const RE = /\[([^\]\n]+)\]\(([^()\s]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?'")\]])|(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w_])/g

export function safeUrl(s) {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

export function inline(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(RE)) {
    const [all, label, href, bare, bold, italic] = m
    if (m.index > last) out.push(text.slice(last, m.index))
    if (label) {
      const url = safeUrl(href)
      out.push(url ? { a: url, kids: inline(label) } : all)
    } else if (bare) {
      const url = safeUrl(bare)
      out.push(url ? { a: url, kids: [bare] } : all)
    } else if (bold) out.push({ b: inline(bold) })
    else out.push({ i: inline(italic) })
    last = m.index + all.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
