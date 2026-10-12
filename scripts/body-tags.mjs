// Inspect rendered text, so Markdown syntax and media URLs are not indexed.
export function collectInlineTags(root) {
  const tags = new Set()
  const blocked = new Set(['pre', 'code', 'a', 'script', 'style'])
  function visit(node) {
    if (blocked.has(node.nodeName)) return
    if (node.nodeName === '#text') {
      for (const match of node.value.matchAll(/(?:^|[\s（(\[【，,。；;：:、！!？?])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu)) tags.add(match[1])
    }
    for (const child of node.childNodes ?? []) visit(child)
  }
  visit(root)
  return [...tags]
}
