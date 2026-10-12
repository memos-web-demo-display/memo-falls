import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import './style.css'

type Entry = { path: string; title: string; date: string; tags: string[]; chunk: number }
type Note = Entry & { content: string }
type TagNode = { name: string; path: string; children: TagNode[]; count: number }
type Index = { entries: Entry[]; chunks: string[]; tagTree: TagNode[] }
const pageSize = 36
const base = import.meta.env.BASE_URL
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseDay = (value: string) => new Date(`${value}T12:00:00`)
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(parseDay(value))

function Markdown({ content, preview = false }: { content: string; preview?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const html = useMemo(() => {
    const clean = DOMPurify.sanitize(marked.parse(content, { breaks: true, gfm: true }) as string, {
      ADD_TAGS: ['video', 'source'], ADD_ATTR: ['controls', 'preload', 'playsinline', 'poster', 'autoplay', 'muted', 'loop'],
    })
    const template = document.createElement('template')
    template.innerHTML = clean
    const last = template.content.lastElementChild
    const origin = last?.tagName === 'P' && last.children.length === 1 && last.firstElementChild?.tagName === 'A' && last.textContent?.trim() === last.firstElementChild.textContent?.trim()
      ? last as HTMLElement : null
    if (origin) {
      origin.className = 'note-source'
      const link = origin.querySelector('a')!
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
    }
    if (preview) {
      origin?.remove()
      const media = template.content.querySelector('img, video')?.cloneNode(true) as HTMLElement | undefined
      template.content.querySelectorAll('img, video, source').forEach((node) => node.remove())
      const tables = document.createElement('div')
      tables.className = 'preview-tables'
      tables.hidden = true
      template.content.querySelectorAll('table').forEach((table) => tables.append(table))
      const excerpt = document.createElement('div')
      excerpt.className = 'preview-excerpt'
      Array.from(template.content.children).filter((node) => node.textContent?.trim()).forEach((node) => excerpt.append(node))
      template.content.replaceChildren()
      if (media) {
        media.removeAttribute('controls')
        const cover = document.createElement('div')
        cover.className = 'preview-media'
        cover.append(media)
        template.content.append(cover)
      }
      template.content.append(excerpt)
      if (tables.childElementCount) template.content.append(tables)
      if (origin) template.content.append(origin)
    }
    template.content.querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy'
      img.decoding = 'async'
      if (img.hasAttribute('src')) { img.dataset.src = img.getAttribute('src') ?? ''; img.removeAttribute('src') }
      if (img.hasAttribute('srcset')) { img.dataset.srcset = img.getAttribute('srcset') ?? ''; img.removeAttribute('srcset') }
    })
    template.content.querySelectorAll('video').forEach((video) => {
      video.playsInline = true
      if (!video.autoplay) video.preload = 'none'
      if (video.hasAttribute('src')) { video.dataset.src = video.getAttribute('src') ?? ''; video.removeAttribute('src') }
      video.querySelectorAll<HTMLSourceElement>('source[src]').forEach((source) => {
        source.dataset.src = source.getAttribute('src') ?? ''
        source.removeAttribute('src')
      })
    })
    return template.innerHTML
  }, [content, preview])
  useEffect(() => {
    const observer = new IntersectionObserver((records) => {
      for (const record of records) {
        if (record.target instanceof HTMLVideoElement) {
          const video = record.target
          if (!record.isIntersecting) { if (video.autoplay) video.pause(); continue }
          if (video.dataset.src) { video.src = video.dataset.src; delete video.dataset.src }
          video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((source) => {
            source.src = source.dataset.src ?? ''
            delete source.dataset.src
          })
          if (video.hasAttribute('muted')) video.muted = true
          if (video.autoplay) void video.play().catch(() => {})
          continue
        }
        if (!record.isIntersecting) continue
        const img = record.target as HTMLImageElement
        if (img.dataset.srcset) img.srcset = img.dataset.srcset
        if (img.dataset.src) img.src = img.dataset.src
        delete img.dataset.srcset
        delete img.dataset.src
        observer.unobserve(img)
      }
    }, { rootMargin: '300px' })
    root.current?.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img))
    root.current?.querySelectorAll('video').forEach((video) => observer.observe(video))
    root.current?.querySelectorAll('pre').forEach((pre) => {
      const button = document.createElement('button')
      button.className = 'code-copy'
      button.type = 'button'
      button.textContent = '复制'
      button.setAttribute('aria-label', '复制代码')
      button.onclick = async () => {
        await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '')
        button.textContent = '已复制'
        window.setTimeout(() => { button.textContent = '复制' }, 1500)
      }
      pre.append(button)
    })
    return () => observer.disconnect()
  }, [html])
  return <div ref={root} className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

function Calendar({ month, setMonth, selected, setSelected, dates }: { month: Date; setMonth: (date: Date) => void; selected: string | null; setSelected: (date: string | null) => void; dates: Set<string> }) {
  const year = month.getFullYear()
  const index = month.getMonth()
  const first = new Date(year, index, 1).getDay()
  const count = new Date(year, index + 1, 0).getDate()
  const days = Array.from({ length: Math.ceil((first + count) / 7) * 7 }, (_, offset) => new Date(year, index, offset - first + 1))
  return <section className="calendar-panel" aria-label="按日期筛选">
    <div className="section-heading"><strong>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(month)}</strong><div className="heading-controls"><button className="icon-button small" aria-label="上个月" onClick={() => setMonth(new Date(year, index - 1, 1))}><ChevronLeft size={18}/></button><button className="icon-button small" aria-label="下个月" onClick={() => setMonth(new Date(year, index + 1, 1))}><ChevronRight size={18}/></button></div></div>
    <div className="calendar-actions"><span>按日期浏览</span><button onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)) }}>回到本月</button></div>
    <div className="calendar-grid weekdays">{['日','一','二','三','四','五','六'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{days.map((day) => { const key = dayKey(day); return <button key={key} className={`calendar-day ${day.getMonth() !== index ? 'outside' : ''} ${dates.has(key) ? 'has-note' : ''} ${key === dayKey(new Date()) ? 'today' : ''} ${selected === key ? 'selected' : ''}`} aria-label={`${day.toLocaleDateString('zh-CN')}${dates.has(key) ? '，有笔记' : ''}`} aria-pressed={selected === key} onClick={() => setSelected(selected === key ? null : key)}>{day.getDate()}</button> })}</div>
  </section>
}

function TagBranch({ nodes, selected, onSelect, depth = 0 }: { nodes: TagNode[]; selected: string | null; onSelect: (tag: string | null) => void; depth?: number }) {
  const [closed, setClosed] = useState<Set<string>>(new Set())
  return <>{nodes.map((node) => <div key={node.path} className="tag-branch">
    <div className={`tag-row ${selected === node.path ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 15 }}>
      {node.children.length ? <button className="tag-chevron" aria-label={closed.has(node.path) ? '展开标签' : '收起标签'} aria-expanded={!closed.has(node.path)} onClick={() => setClosed((current) => { const next = new Set(current); if (next.has(node.path)) next.delete(node.path); else next.add(node.path); return next })}>{closed.has(node.path) ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button> : <span className="tag-leaf-dot"/>}
      <button className="tag-name" aria-pressed={selected === node.path} onClick={() => onSelect(selected === node.path ? null : node.path)}>{node.name}</button><span className="tag-count">{node.count}</span>
    </div>
    {node.children.length > 0 && !closed.has(node.path) && <TagBranch nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1}/>}
  </div>)}</>
}

function Masonry({ children, watch }: { children: ReactNode[]; watch: string }) {
  const root = useRef<HTMLDivElement>(null)
  const layout = useCallback(() => {
    const container = root.current
    if (!container) return
    const items = Array.from(container.children) as HTMLElement[]
    const width = container.clientWidth
    const mobile = window.innerWidth <= 650
    const gap = mobile ? 8 : 18
    const count = mobile ? 2 : Math.max(1, Math.floor((width + gap) / (265 + gap)))
    const cardWidth = Math.min(455, Math.floor((width - gap * (count - 1)) / count))
    const offset = Math.max(0, Math.floor((width - (cardWidth * count + gap * (count - 1))) / 2))
    items.forEach((item) => { item.style.width = `${cardWidth}px` })
    const heights = Array(count).fill(0) as number[]
    items.forEach((item) => {
      const column = heights.indexOf(Math.min(...heights))
      item.style.left = `${offset + column * (cardWidth + gap)}px`
      item.style.top = `${heights[column]}px`
      heights[column] += item.offsetHeight + gap
    })
    container.style.height = `${Math.max(0, ...heights.map((height) => height - gap))}px`
  }, [])
  useLayoutEffect(() => { layout() }, [layout, watch, children.length])
  useEffect(() => {
    const container = root.current
    if (!container) return
    const observer = new ResizeObserver(() => requestAnimationFrame(layout))
    observer.observe(container)
    Array.from(container.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [layout, watch, children.length])
  return <div ref={root} className="masonry">{children.map((child, index) => <div className="masonry-item" key={index}>{child}</div>)}</div>
}

function NoteDetail({ note, onClose }: { note: Note; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.body.style.overflow
    const focused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    dialog.current?.showModal()
    return () => { document.body.style.overflow = previous; focused?.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className="note-detail" aria-label="笔记详情" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="detail-top"><time>{formatDate(note.date)}</time><button className="icon-button" aria-label="关闭笔记" onClick={onClose} autoFocus><X size={21}/></button></div>
    <article className="detail-content">
      {!/^\s*(?:#{1,6}\s|<h[1-6](?:\s|>))/i.test(note.content) && <h2 className="memo-title">{note.title}</h2>}
      <Markdown content={note.content}/>
    </article>
  </dialog>
}

function App() {
  const [detail, setDetail] = useState<Note | null>(null)
  const [index, setIndex] = useState<Index | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const pendingChunks = useRef(new Map<number, Promise<Record<string, string>>>())
  const [tags, setTags] = useState<TagNode[]>([])
  const [dates, setDates] = useState<Set<string>>(new Set())
  const [loadedCount, setLoadedCount] = useState(pageSize)
  const loadSentinel = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageError, setPageError] = useState('')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 650)
  const sidebarToggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!sidebarOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setSidebarOpen(false); sidebarToggle.current?.focus() }
    }
    document.addEventListener('keydown', closeOnEscape)
    const mobile = window.matchMedia('(max-width: 650px)').matches
    if (mobile) document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [sidebarOpen])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const indexResponse = await fetch(`${base}data/index.json`, { cache: 'no-cache', signal: controller.signal })
        if (!indexResponse.ok) throw new Error(`索引加载失败 (${indexResponse.status})`)
        const loaded: Index = await indexResponse.json()
        if (!Array.isArray(loaded.entries) || !Array.isArray(loaded.chunks) || !Array.isArray(loaded.tagTree)) throw new Error('索引格式错误')
        setTags(loaded.tagTree)
        setDates(new Set(loaded.entries.map((entry) => entry.date)))
        setIndex(loaded)
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '笔记加载失败') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    load()
    return () => controller.abort()
  }, [])
  const visible = useMemo(() => (index?.entries ?? []).filter((note) => (!selectedDate || note.date === selectedDate) && (!selectedTag || note.tags.some((tag) => tag === selectedTag || tag.startsWith(`${selectedTag}/`)))), [index, selectedDate, selectedTag])
  const loadedEntries = useMemo(() => visible.slice(0, loadedCount), [visible, loadedCount])
  useEffect(() => {
    if (!index || loadedEntries.length === 0) return
    let active = true
    const needed = [...new Set(loadedEntries.filter((entry) => typeof contents[entry.path] !== 'string').map((entry) => entry.chunk))]
    if (!needed.length) return
    setPageError('')
    Promise.all(needed.map((number) => {
      let pending = pendingChunks.current.get(number)
      if (!pending) {
        pending = fetch(`${base}data/${index.chunks[number]}`).then(async (response) => {
          if (!response.ok) throw new Error(`笔记内容加载失败 (${response.status})`)
          return response.json() as Promise<Record<string, string>>
        })
        pendingChunks.current.set(number, pending)
      }
      return pending.catch((reason) => { pendingChunks.current.delete(number); throw reason })
    })).then((parts) => {
      if (active) setContents((current) => Object.assign({}, current, ...parts))
    }).catch((reason) => { if (active) setPageError(reason instanceof Error ? reason.message : '笔记内容加载失败') })
    return () => { active = false }
  }, [index, loadedEntries, contents])
  const loadedNotes: Note[] = loadedEntries.filter((entry) => typeof contents[entry.path] === 'string').map((entry) => ({ ...entry, content: contents[entry.path] }))
  const batchLoading = loadedNotes.length !== loadedEntries.length
  const hasMore = loadedCount < visible.length
  useEffect(() => {
    const sentinel = loadSentinel.current
    if (!sentinel || loading || error || pageError || batchLoading || !hasMore) return
    const observer = new IntersectionObserver((records) => {
      if (records[0]?.isIntersecting) setLoadedCount((current) => Math.min(current + pageSize, visible.length))
    }, { rootMargin: '300px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loading, error, pageError, batchLoading, hasMore, loadedCount, visible.length])
  const changeDate = (date: string | null) => { window.scrollTo({ top: 0, behavior: 'instant' }); setLoadedCount(pageSize); setSelectedDate(date); if (window.innerWidth <= 650) setSidebarOpen(false) }
  const changeTag = (tag: string | null) => { window.scrollTo({ top: 0, behavior: 'instant' }); setLoadedCount(pageSize); setSelectedTag(tag); if (window.innerWidth <= 650) setSidebarOpen(false) }
  return <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
    <aside className="sidebar" id="filters-sidebar" aria-label="筛选侧栏" inert={!sidebarOpen}>
      <div className="sidebar-top"><div className="brand"><span className="brand-mark">✦</span><span>Memo Falls</span></div><button className="icon-button" aria-label="隐藏侧栏" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={20}/></button></div>
      <Calendar month={month} setMonth={setMonth} selected={selectedDate} setSelected={changeDate} dates={dates}/>
      <section className="tags-panel" aria-label="按标签筛选"><div className="section-heading"><strong>标签</strong><span className="section-subtitle">TAG TREE</span></div><button className={`all-tags ${selectedTag === null ? 'active' : ''}`} onClick={() => changeTag(null)}><span className="all-tags-icon">✳</span>全部标签<span>{index?.entries.length ?? 0}</span></button>{tags.length > 0 ? <TagBranch nodes={tags} selected={selectedTag} onSelect={changeTag}/> : !loading && <p className="no-tags">暂无标签</p>}</section>
    </aside>
    {sidebarOpen && <button className="mobile-scrim" aria-label="关闭侧栏" onClick={() => setSidebarOpen(false)}/>}
    <main className="main"><header className="main-toolbar"><button ref={sidebarToggle} className="icon-button toggle-button" aria-controls="filters-sidebar" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? '隐藏侧栏' : '显示侧栏'} onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <Menu size={20}/> : <PanelLeftOpen size={20}/>}</button><div className="active-filters">{selectedDate && <button aria-label="清除日期筛选" onClick={() => changeDate(null)}><CalendarDays size={14}/><span>{selectedDate}</span><X size={13}/></button>}{selectedTag && <button aria-label="清除标签筛选" onClick={() => changeTag(null)}><span>#{selectedTag}</span><X size={13}/></button>}</div>{selectedDate && selectedTag && <button className="clear-filters" onClick={() => { changeDate(null); changeTag(null) }}>清除全部</button>}<span className="note-total" aria-live="polite">{loading ? '加载中...' : `${visible.length} 条笔记`}</span></header>
      <section className="demo-notice" aria-label="演示站点说明"><span className="demo-label">DEMO</span><div><strong>Memos 信息流展示</strong><p>这是一个用于展示精美 Memos 布局与交互的演示站点。</p></div></section>
      {error ? <div className="state-message"><strong>无法读取笔记</strong><p>{error}</p></div> : loading ? <div className="state-message">正在读取笔记索引...</div> : <>
        <Masonry watch={`${sidebarOpen}:${selectedDate}:${selectedTag}:${loadedNotes.length}`}>{loadedNotes.map((note) => <article className="memo-card compact-card" key={note.path} role="button" tabIndex={0} aria-label="查看完整笔记" onClick={(event) => { if (!(event.target as Element).closest('button, a')) setDetail(note) }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setDetail(note) } }}><div className="memo-meta"><time dateTime={note.date}>{formatDate(note.date)}</time><span className="memo-year">{note.date.slice(0,4)}</span></div><h2 className="memo-title">{note.title}</h2><Markdown content={note.content} preview/></article>)}</Masonry>
        {visible.length === 0 && <div className="state-message"><strong>没有符合条件的笔记</strong><p>换个日期或标签试试。</p><button onClick={() => { changeDate(null); changeTag(null) }}>清除筛选</button></div>}
        {pageError && <div className="load-status" role="alert">加载失败：{pageError} <button onClick={() => { setPageError(''); setContents((current) => ({ ...current })) }}>重试</button></div>}
        {batchLoading && !pageError && <div className="load-status" role="status">正在加载更多笔记…</div>}
        {hasMore && <div ref={loadSentinel} className="load-sentinel" aria-hidden="true"/>}
        {!hasMore && visible.length > 0 && !batchLoading && <div className="load-status end">已显示全部 {visible.length} 篇笔记</div>}
      </>}
    </main>
    {detail && <NoteDetail note={detail} onClose={() => setDetail(null)}/>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App/>)
