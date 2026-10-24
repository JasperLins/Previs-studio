# Design · Phase 1 多项目库

## 1. 边界与模块

```
src/projects/               ← 新增（fork 纪律：功能代码新文件，零上游冲突）
  projectStore.js           IndexedDB 封装 + 纯函数（元信息派生、id、唯一命名）
  projectStore.test.js      node:test 单测（仅纯函数，不 mock IndexedDB）
  ProjectsPanel.jsx         纯展示面板（哑组件，回调驱动，参照 PromptPanel 形态）
src/App.jsx                 ← 接缝 S8（挂载与传参 + 少量状态接线）
src/styles.css              ← 末尾追加 dg-projects-* 类
```

分层原则：`ProjectsPanel` 不碰 IndexedDB；所有库操作由 App 侧回调执行（App 已持有 projectData/normalize/applyProjectSnapshot/uid 等全部上下文），面板只收 `entries / activeProjectId / busy / onOpen / onNew / onDuplicate / onRename / onDelete / onExport / onImport / unavailable`。

## 2. 数据契约

### 2.1 IndexedDB

- DB `monoform-projects`，version 1；对象仓 `projects`，keyPath `id`，索引：`updatedAt`（列表排序用）。
- 条目：

```js
{
  id: string,            // crypto.randomUUID()（回退：时间戳+随机）
  name: string,          // = data.settings.name（0..40）
  createdAt: number,     // epoch ms
  updatedAt: number,     // epoch ms，每次 upsert 刷新
  shotCount: number,
  cover: string,         // 首个非空 shot.thumbnail（JPEG dataURL），无则 ''
  data: object,          // projectData() 输出（version: PROJECT_VERSION）
}
```

### 2.2 localStorage（键位分工）

| 键 | 角色 | 写入策略 |
|---|---|---|
| `monoform-project`（现有） | 全量缓存：启动加速 + 原版 MONOFORM 互看 | 尽力写；配额失败静默（首次 toast 提示"已存入项目库"） |
| `monoform-active-project-id`（新） | 活动项目指针 | 切换/新建/导入即写 |

项目库（IndexedDB）为唯一权威存储；localStorage 两个键都可丢弃重建（指针丢失→列表第一项）。

### 2.3 纯函数（projectStore.js，可测）

- `makeEntryFromProject(id, data, now)` → 条目（派生 name/shotCount/cover；容错：shots 非数组、thumbnail 缺失）。
- `uniqueProjectName(existingNames, desired)` → 重名时追加 " 2"/" 3"…
- `createProjectId()` → randomUUID 回退 uid 形态。
- `relativeTime(now, updated)` → "刚刚 / N 分钟前 / HH:mm / MM-DD HH:mm"（列表展示）。
- IndexedDB 读写薄封装：`openStore() / listEntries() / getEntry(id) / putEntry(entry) / deleteEntry(id)`，Promise 化；`openStore` 失败置 `unavailable` 状态（R1.4 降级）。

## 3. App.jsx 接缝 S8（锚点与改动面）

| 锚点 | 改动 |
|---|---|
| 顶部 import | `ProjectsPanel`、`projectStore` 具名导入 |
| `App()` 状态区（promptTabOpen 附近） | `promptTabOpen` → `rightTab` 三态；`activeProjectId`；`libraryEntries`；`libraryBusy`；`storeUnavailable`；`libraryVersion`（变更计数） |
| 启动（新增 boot effect，一次） | `ensureBootEntry(currentProject)`：库空+指针空 → 迁移 localStorage 工程（或初始状态）入库；指针有但条目缺 → 回退列表第一项 |
| 自动保存 effect（900ms 防抖） | 双写：`putEntry(makeEntryFromProject(activeProjectId, currentProject, Date.now()))` + localStorage 尽力写；状态文案以库写入为准 |
| `resetProject`（新建） | 前置 flush：当前工程入库 → 新 id + 指针 → 原 reset 逻辑不动 → 注册新空工程条目 |
| `loadProject`（顶栏导入） | 解析成功后：新 id 入库 + 指针切换（状态设置复用 applyProjectSnapshot，消除现有重复代码） |
| 新增回调区 | `openProject / duplicateProject / renameProject / deleteProject / exportProject / flushCurrentProject` |
| 右侧栏页签区（dg-panel-tabs） | 三页签渲染 + `rightTab === 'projects'` 时挂 `<ProjectsPanel …/>` |
| 顶栏「保存」`saveProject` | 本地分支不变（仍写两键）；导出分支不变 |

不变式：`applyProjectSnapshot`、`normalizeProjectData`、`projectData`、`PROJECT_VERSION`、历史栈逻辑、diagram 全链路均不改。

## 4. 关键流程

### 4.1 启动
```
useState 初始化仍读 localStorage 缓存（同步、零回归）
boot effect(一次):
  openStore 失败 → storeUnavailable=true，其余行为=现状
  指针存在且条目在 → activeProjectId=指针（缓存即该工程，无需动作）
  指针存在但条目缺（悬空，如多标签删库）→ 当前启动状态注册为新项目（孤儿注册，避免把缓存态错绑/覆盖旧条目）
  指针无 → 库空 ? 迁移当前(=localStorage 或初始态)入库 : 孤儿注册（uniqueProjectName 避免重名）
  ※ 2026-10-24 check 修订：原稿“回退列表第一项”会把启动缓存态错绑到旧条目上，孤儿注册更数据安全
```

### 4.2 打开项目（openProject）
```
flushCurrentProject()（立即 putEntry，不等防抖）
entry = await getEntry(id) → applyProjectSnapshot(entry.data)
activeProjectId=id + 指针写入 → libraryVersion++ → toast
```
applyProjectSnapshot 已覆盖 settings/shots/objects/camera/lighting/reference/keyframes/objectKeyframes/diagram/activeShotId；切换后自动保存 effect 自然双写新工程。

### 4.3 新建（面板/顶栏共用）
```
flushCurrentProject() → id=createProjectId()
resetProject 原逻辑执行 → activeProjectId=id + 指针 → 立即注册空工程条目
```
「新建」入口改为新函数 `startNewProject`（内部调 resetProject），原 resetProject 保留不删（其他调用点不受影响，若有）。

### 4.4 自动保存双写（改现有 effect 体）
```
try localStorage.setItem(缓存) catch → quotaMissRef 首次提示
putEntry(...).then(→ setSaveStatus('已自动保存')).catch(→ '自动保存失败')
```
竞态：防抖 900ms + IndexedDB 事务串行，最后一次 upsert 即最终态；不做写队列。

### 4.5 降级（storeUnavailable）
面板显示"项目库不可用（浏览器隐私模式？），工程仍自动保存到本浏览器单槽"；所有库按钮禁用；新建=原 resetProject 直通。

## 5. 失败模式

| 场景 | 行为 |
|---|---|
| localStorage 配额满 | 缓存跳过（首次 toast），库存成功 → 状态正常（修掉现状"空间不足"常驻问题） |
| IndexedDB 打开失败 | R1.4 降级；不重试风暴，仅进入时探测一次 |
| 条目 data 损坏/版本陈旧 | applyProjectSnapshot 内 normalizeProjectData 已做迁移补默认（现状能力，零新代码） |
| 多标签并发 | 各自防抖写，最后写入胜；列表在打开页签/操作后刷新（libraryVersion），不做跨标签广播 |
| 删除活动项目 | UI 禁用；防御性兜底：boot 发现指针悬空回退第一项 |

## 6. 兼容与回滚

- 导出格式/版本/原版互开：不变（本期不碰 projectData/normalize）。
- 上线即迁移、回滚安全：回滚到旧版后，localStorage 缓存键里仍是最后一次双写的工程，旧版直接可用；IndexedDB 残留库不影响旧版运行。
- 发布路径：`npm run build` → CloudBase 静态托管重新部署，无配置变更。

## 7. UI 草图（ProjectsPanel）

```
┌ 项目库 ──────────── 3 PROJECTS ─ [＋ 新建] ┐
│ ┌────┐ 未命名场景            ▲ACTIVE  ●   │
│ │封面 │ 4 镜头 · 刚刚        [打开][复制]   │
│ └────┘            [更名][导出][删除]       │
│ ┌────┐ 课堂样例 副本                        │
│ │封面 │ 6 镜头 · 10-24 14:32 [打开][复制]…  │
└────────────────────────────────────────────┘
```
- 行布局参照镜头卡片（缩略图 4:3 或 16:9 小图 + 文案列 + 操作区）；重命名走行内 input（双击或"更名"进入，交互同镜头卡）。
- busy 期间按钮禁用 + 轻量加载指示；操作结果用现有 toast。
