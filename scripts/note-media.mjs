export function metadataHTML(fm, assets) {
  const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  let html = ''
  for (const [field, type, pattern] of [['image_cover_id', 'img', /\.(png|jpe?g|gif|webp)$/i], ['video_cover_id', 'video', /\.(mp4|webm)$/i]]) {
    const name = fm[field]
    if (name == null) continue
    if (typeof name !== 'string' || /[/\\]/.test(name) || !pattern.test(name) || !assets.has(name)) throw new Error(`Invalid or missing asset: ${field}`)
    const src = escape(`./data/assets/${name}`)
    html += type === 'img' ? `<p><img src="${src}" alt=""></p>\n` : `<video src="${src}" autoplay muted loop playsinline controls preload="none"></video>\n`
  }
  if (fm.origin_url) {
    if (typeof fm.origin_url !== 'string' || !/^https?:\/\/\S+$/.test(fm.origin_url)) throw new Error('origin_url must be HTTP(S)')
    html += `<p><a href="${escape(fm.origin_url)}">查看来源</a></p>\n`
  }
  return html
}
