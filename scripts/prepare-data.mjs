import { readdir, readFile, rm, mkdir, writeFile, cp } from 'node:fs/promises'
import { join, relative, basename, dirname, sep } from 'node:path'
import { parse } from 'yaml'
import { createHash } from 'node:crypto'
import { parseFragment } from 'parse5'
import { marked } from 'marked'
import { collectInlineTags } from './body-tags.mjs'
import { metadataHTML } from './note-media.mjs'

const source = join(process.cwd(), 'data')
const output = join(process.cwd(), 'public', 'data')
const assets = join(source, 'assets')

const assetNames = new Set((await readdir(assets, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name))

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [path] : []
  }))
  return files.flat().sort()
}

function metadata(raw, path) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const frontmatter = match ? parse(match[1]) : {}
  if (frontmatter == null || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) throw new Error(`${path}: YAML metadata must be an object`)
  const fallback = basename(path, '.md').replace(/^\d{4}-\d{2}-\d{2}[-_]?/, '').replace(/[-_]/g, ' ')
  const title = String(frontmatter.title || fallback).trim()
  const date = String(String(frontmatter.create_date || '').slice(0, 10) || frontmatter.date || basename(path).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`${path}: add a valid date: YYYY-MM-DD in frontmatter or filename`)
  const inputTags = frontmatter.tags == null ? [] : Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags]
  const tags = [...new Set(inputTags.map((tag) => String(tag).split('/').map((part) => part.trim()).filter(Boolean).join('/')).filter(Boolean))]
  if (!title) throw new Error(`${path}: title is empty`)
  return { title, date, tags, frontmatter }
}

const files = await markdownFiles(source)
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
const entries = []
const contents = {}
for (const file of files) {
  const raw = await readFile(file, 'utf8')
  const path = relative(source, file).split(sep).join('/')
  const { frontmatter, ...info } = metadata(raw, path)
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim()
  const rendered = marked.parse(body, { breaks: true, gfm: true }) + metadataHTML(frontmatter, assetNames)
  info.tags = [...new Set([...info.tags, ...collectInlineTags(parseFragment(rendered))])]
  await mkdir(dirname(join(output, path)), { recursive: true })
  await writeFile(join(output, path), raw)
  entries.push({ path, ...info })
  contents[path] = rendered
}
await cp(assets, join(output, 'assets'), { recursive: true })
entries.sort((a, b) => b.date.localeCompare(a.date) || a.path.localeCompare(b.path))
const chunkSize = 36
const chunks = []
await mkdir(join(output, 'chunks'), { recursive: true })
for (let start = 0; start < entries.length; start += chunkSize) {
  const chunkNumber = chunks.length
  const body = Object.fromEntries(entries.slice(start, start + chunkSize).map((entry) => [entry.path, contents[entry.path]]))
  const json = JSON.stringify(body)
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12)
  const file = `chunks/${String(chunkNumber).padStart(4, '0')}-${hash}.json`
  await writeFile(join(output, file), json)
  chunks.push(file)
  for (const entry of entries.slice(start, start + chunkSize)) entry.chunk = chunkNumber
}
// Tag hierarchy comes from note metadata and body tags, never directories.
function buildTagTree(entries) {
  const roots = new Map()
  for (const entry of entries) for (const tag of entry.tags) {
    let siblings = roots
    let path = ''
    for (const name of tag.split('/')) {
      path = path ? `${path}/${name}` : name
      if (!siblings.has(name)) siblings.set(name, { name, path, notes: new Set(), children: new Map() })
      const node = siblings.get(name)
      node.notes.add(entry.path)
      siblings = node.children
    }
  }
  const serialize = (nodes) => [...nodes.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map((node) => ({ name: node.name, path: node.path, count: node.notes.size, children: serialize(node.children) }))
  return serialize(roots)
}
await writeFile(join(output, 'index.json'), JSON.stringify({ entries, chunks, tagTree: buildTagTree(entries) }, null, 2) + '\n')
console.log(`Prepared ${entries.length} Markdown notes in ${chunks.length} content chunks from data/`)
