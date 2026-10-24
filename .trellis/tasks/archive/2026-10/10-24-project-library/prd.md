# Phase 1 多项目库：IndexedDB 项目管理面板

## Goal

ComfyUI 式项目管理：IndexedDB 多项目库 + 右侧栏第三个页签「项目」，支持新建/打开/复制/重命名/删除/导出。修复现状"单槽 localStorage，点『新建』旧工程被静默覆盖丢失"的数据丢失陷阱。纯前端方案，CloudBase 静态托管部署零影响；全班同时使用时各人浏览器互不干扰（按 域名+浏览器+电脑 隔离）。

## Requirements

### R1 项目库存储（IndexedDB）

- R1.1 新模块 `src/projects/projectStore.js`：IndexedDB 库 `monoform-projects`，对象仓 `projects`（keyPath `id`）。条目字段：`{ id, name, createdAt, updatedAt, shotCount, cover, data }`，`data` 为 `projectData()` 完整工程 JSON。
- R1.2 条目元信息从工程 JSON 派生（名称=settings.name、镜头数、封面=首个有缩略图的镜头 thumbnail），派生逻辑为纯函数并配 node:test 单测。
- R1.3 项目 id 用 `crypto.randomUUID()`（含回退）；不依赖 App.jsx 内部函数。
- R1.4 IndexedDB 不可用（隐私模式等极端情况）时降级为现状单槽行为：面板显示不可用提示，其余功能不受影响，不得抛未捕获错误。

### R2 右侧栏「项目」页签（UI）

- R2.1 右侧栏页签区（现有 属性/机位词）加第三个页签「项目」；`promptTabOpen` 布尔态改为 `rightTab` 三态（'inspector' | 'prompt' | 'projects'），原两页签行为不变。
- R2.2 列表按 updatedAt 倒序：封面缩略图、名称、镜头数、更新时间；当前项目高亮标记。
- R2.3 行内重命名（复用镜头卡片的交互模式：Enter/blur 提交、Esc 取消、空值回退、上限 40 字符与工程名称一致）。
- R2.4 操作集：打开 / 复制（生成"XX 副本"，不切换当前）/ 删除（window.confirm 确认，与删除镜头/姿势同模式；当前活动项目禁删）/ 导出（从库内条目导出 `.monoform.json`，文件名规则与现有导出一致）/ 新建（面板头部按钮）。

### R3 生命周期与自动保存

- R3.1 启动迁移（一次性）：项目库为空时，把现有 localStorage 工程（若有）导入为第一个项目；库为空且 localStorage 也为空 → 用当前初始状态注册默认项目。已迁移过的（指针存在）不再重复导入。
- R3.2 活动项目指针存 localStorage（小键，如 `monoform-active-project-id`）；现有 `monoform-project` 全量缓存键保留，作为启动加速与原版 MONOFORM 互看的缓存，继续尽力写入。
- R3.3 自动保存（现有 900ms 防抖 effect）双写：IndexedDB 条目 upsert（权威）+ localStorage 缓存尽力写。localStorage 配额不足但库写入成功时，状态显示按成功处理（不再长期显示"空间不足"恐吓；首次降级可提示一次"已存入项目库"）。
- R3.4 新建：当前工程立即入库（不等防抖）→ 生成新 id → 调用现有 resetProject 逻辑 → 指针切换 → 新工程随即注册入库。
- R3.5 打开/导入：当前工程立即入库 → 读目标条目 → 复用现有快照应用逻辑（normalize 走 applyProjectSnapshot 同一入口）→ 指针切换。
- R3.6 刷新/重开浏览器：回到指针指向的项目；指针指向的条目已被删（如它机操作不可能，但多标签删库防御）→ 当前启动状态注册为新项目（孤儿注册，不覆盖库内既有条目），仍无库则走 R3.1。※ 2026-10-24 check 修订：原“回退第一项”存在把缓存态错绑旧条目的风险。
- R3.7 导入 JSON（顶栏「打开」）：走新 id 入库并切换，成为库内新项目。

### R4 兼容与纪律

- R4.1 导出文件格式、`PROJECT_VERSION`、原版 MONOFORM 打开导出文件：全部不变。
- R4.2 撤销/重做（内存机制）不受影响；跨项目切换后历史清空或仅限当前会话均可接受（现状 applyProjectSnapshot 行为保持）。
- R4.3 fork 纪律：App.jsx 改动全部落在新接缝 S8（登记 PATCHES.md/base-audit.md）；新逻辑放 `src/projects/`；styles.css 只在末尾追加 `dg-` 类；不新增 npm 依赖。
- R4.4 多标签同时开同一站点：允许各标签独立编辑，最后写入者胜（与现状一致，不做合并）。

## Out of Scope（Phase 2/3 备选，本期不做）

- File System Access API 真实文件夹镜像/连接。
- CloudBase 云端项目库（账号体系/数据库）。
- 项目搜索、排序切换、标签、协作、项目模板。
- 自动导出备份到磁盘。

## Acceptance Criteria

- [x] 老用户零感迁移：带着 localStorage 工程首次打开新版，项目库里出现该工程且内容与原来一致，继续编辑正常。
- [x] 「新建」后旧工程仍在项目库中可随时打开，内容为新建那一刻的完整状态（含 diagram 扩展字段）。
- [x] 打开其它项目再切回，名称/物体/镜头/关键帧/diagram 全部还原；刷新浏览器回到当前活动项目。
- [ ] 复制/重命名/删除/导出在面板内完成；删除有确认；活动项目删除按钮禁用。
- [ ] 大工程（含 GLB data URL，>5MB）保存时不再因 localStorage 配额失败而丢失——库内保存成功，状态指示正常。
- [ ] 导出的 `.monoform.json` 用原版 MONOFORM（线上版）打开正常。
- [ ] IndexedDB 被禁用时应用不崩溃，退化为现状行为并有提示。
- [x] `npm run build` 通过；`node --test src/projects/projectStore.test.js` 通过；diagram 回归 136 单测通过。
- [x] App.jsx diff 全部落在 S8 接缝；styles.css 仅末尾追加 dg- 类；PATCHES.md 已登记 S8。
