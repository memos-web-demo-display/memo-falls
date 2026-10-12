# Memo Falls · Memos 信息流展示 Demo

一个参考 Memos 的独立、只读信息流展示项目，探索 Markdown 笔记在手机和桌面上的阅读体验。不是 Memos 官方网站，也不提供 Memos 服务端。

[打开演示网站](https://memos-web-demo-display.github.io/memo-falls/)

## 界面与交互

- 手机双列瀑布流，桌面随可用宽度自动增加列数。
- 紧凑卡片展示摘要，点击后阅读完整内容。
- 图片、视频保持原始比例，不统一裁切；媒体接近视口时加载。
- 视频支持静音、内联循环播放。
- 日历和层级标签树支持组合筛选，侧栏可以隐藏。
- 滚动接近底部时自动续载，无需手动翻页。
- 支持 Markdown 标题、列表、引用、表格、链接和代码块。

## Markdown 示例

`demo/` 提供可直接阅读和复用的 Markdown 示例，配套图片和视频在 `demo/assets/`。这些示例供参考笔记格式，不与站点的数据目录混放：

- [图片笔记](demo/example-1.md)
- [视频笔记](demo/example-2.md)
- [文字与表格笔记](demo/example-3.md)

示例包括正文、表格标签、日期、来源和封面字段。内容仅用于格式、布局与交互参考。

封面字段填写 `demo/assets/` 中的文件名，例如 `sample-note.png` 或 `sample-loop.mp4`；没有封面时填写 `null`。标签直接写在正文表格里，例如 `#阅读, #技术/Go`，不必手工维护 YAML `tags`。

## 目录

- `demo/`：Markdown 示例，供阅读和复用。
- `demo/assets/`：示例的图片与视频。
- `data/`：站点使用的数据目录，与参考示例分开。
- `data/assets/`：媒体资源。
- `src/`：页面组件和样式。
- `scripts/prepare-data.mjs`：生成日期、标签索引与分批内容。

构建时生成标签树，标签层级不依赖文件夹结构。一篇笔记可以关联多个标签，正文表格中的 `#标签` 也会加入索引。`create_date` 用于日历归档。站点默认读取 `data/`，不会把 `demo/` 自动合并进信息流。页面先加载索引，再按需读取正文和媒体。

## 本地预览与发布

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

推送到 `main` 后，GitHub Actions 自动构建并发布至 GitHub Pages。网站只提供浏览和筛选，不提供在线编辑。
