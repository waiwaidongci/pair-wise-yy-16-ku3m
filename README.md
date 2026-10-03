# Mira Lin · 摄影师作品集

独立摄影师作品集站点（React + TypeScript + Vite）：五个页面、共享灯箱、离线可用字体、
移动端响应式、完整表单校验，并为“外拍断网改便签”提供本地覆盖层与逐条三向合并。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 生产构建（dist/）
npm run preview    # 预览生产构建 http://localhost:4173

npm run test:e2e   # Playwright 端到端（会自动起 dev server）
# 对生产构建跑同一套测试：
npm run build && npx playwright test --config=playwright.preview.config.ts
```

> 无 root 的 Linux 环境若缺 Chromium 系统库，可用 `LD_LIBRARY_PATH` 指向自行解压的
> deb 库目录；这只影响本机跑浏览器，与应用代码无关。

## 页面

| 路由 | 内容 |
|---|---|
| `/` | Hero 摄影师简介 + 三个系列精选入口 |
| `/work` | 全部照片 masonry 网格，按 肖像/风光/牧野 筛选 |
| `/work/:seriesId` | 叙事式长图文（图文交替、斜体 pull-quote、金色分隔线），可开“临时便签”编辑 |
| `/about` | 简介 + 金色圆点时间线 |
| `/contact` | Name/Email/Message 下划线表单，行内校验、失败保留草稿、成功反馈态 |

灯箱是挂在布局层的**共享组件**（不是路由），五页任意照片可打开，键盘 ←/→/Esc。

## 关键约束是怎么实现的

1. **筛选跨导航保持**：筛选状态在 `FilterProvider`（路由树之外），并持久化到
   sessionStorage；进出系列页不重置。
2. **灯箱范围＝当前数据**：打开灯箱传入的是“已解析的照片数组”而不是分类 id
   （`openAt(photos, startId, scopeKey)`）。系列重排/筛选/另一端合并后，
   `Work`/`SeriesDetail` 的 effect 调 `rebind(newPhotos)`：**按照片 id 重新定位**，
   当前照片不在新范围时停在首张，旧下标绝不平移到别的照片上。
3. **零 CLS**：`RatioImage` 用照片真实 `width/height` 写 `aspect-ratio`，
   图片在占位框内加载、完成后淡入。
4. **单一数据模型**：所有页面只读 `mock-data/photos.json` 派生的视图；
   系列页不硬编码任何照片/文案。
5. **移动端**：≤980px 灯箱说明由右侧信息带变底部信息条；≤680px 汉堡导航、
   筛选横滑、masonry 三列→单列、标题移到图下。
6. **字体离线**：仅 `@font-face` 引用 `/fonts/*.woff2`（来自 `assets/fonts`），
   无任何 Google CDN；dev 由 Vite 中间件就地提供，build 拷入 `dist/fonts`。
7. **表单**：空值/格式/长度行内错误，未通过禁用提交；模拟提交失败时内容留草稿可重试，
   成功切换到成功面板。

## 本地覆盖层与同步（核心）

原始照片资料（`mock-data/`）**只读**，摄影师的临时修改全部进覆盖层：

- `src/data/catalog.ts` — 冻结的只读基础目录（直接 import JSON，永不回写）。
- `src/sync/server.ts` — 模拟“远端”（localStorage 第三方存储，跨标签页通过
  storage 事件可见）。`commitField` 做**字段级三向合并**：
  本地值=祖先值 → 采远端；远端值=祖先值 → 采本地；两边改成相同值 → 幂等成功；
  **两边都改且不同 → 409，两个版本都返回**。
- `src/sync/store.ts` — 覆盖层引擎：
  - 编辑按字段入队（同一字段离线连续编辑只留一条，保留共同祖先 base）；
  - **离线时冻结远端视图**，另一端的提交在本地不可见，恢复连接先整体拉取再逐条合并；
  - 未冲突字段自动合并；同字段两边都改 → 页面出现冲突横幅，两份版本并列待选，
    选“我的”会以远端现值为新祖先重新提交，选“另一处”直接回到远端版本；
  - 提交失败（可用左下角“模拟弱网”复现）草稿带 `lastError` 留队，可重试；
  - flush 串行化但会排空期间新入队的草稿，不丢条；
  - **v1 旧草稿迁移**：`{title,note,cover,ids}` 旧结构升级为 v2 字段级队列后继续同步。
- 已提交覆盖在 localStorage（跨标签页共享），待提交草稿/冲突在 sessionStorage
  （按标签页隔离，正好对应两个编辑端）。

左下角同步胶囊可展开：在线/离线状态、队列逐条状态、手动断网/弱网开关、
重试失败、立即同步。

## 目录

```
mock-data/        原始照片与 photos.json（只读，不动）
assets/fonts/     离线字体源文件（不动，dev 挂载/build 拷贝）
src/
  data/           只读目录与类型
  sync/           覆盖层、模拟远端、迁移与三向合并
  state/          Overlay / Filter / Lightbox 三个 Context
  components/      RatioImage、Lightbox、SeriesEditor、ConflictBanner、SyncDock…
  pages/          五页 + Layout
e2e/              Playwright：导航/灯箱、离线同步冲突、表单、移动响应式、CLS、字体
```
