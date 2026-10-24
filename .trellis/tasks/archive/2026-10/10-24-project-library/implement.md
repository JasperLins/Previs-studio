# Implement · Phase 1 多项目库

> 执行顺序即依赖顺序；每步末有验证点。全程遵守 fork-discipline（接缝 S8、新文件承载逻辑、styles.css 末尾追加、零新依赖）。

## Step 1 · projectStore 纯函数层 + 单测

- [ ] 新建 `src/projects/projectStore.js`：`createProjectId / makeEntryFromProject / uniqueProjectName / relativeTime`（纯函数）+ `openStore / listEntries / getEntry / putEntry / deleteEntry`（IndexedDB 薄封装，Promise 化，`openStore` 缓存连接）。
- [ ] 新建 `src/projects/projectStore.test.js`：node:test 覆盖——条目派生（正常/空 shots/无缩略图/settings.name 缺省）、唯一命名（不重名原样/重名递增）、relativeTime 各档、id 回退。
- [ ] 验证：`node --test src/projects/projectStore.test.js` 绿。

## Step 2 · ProjectsPanel 哑组件

- [ ] 新建 `src/projects/ProjectsPanel.jsx`：props 见 design §1；列表（cover/name/shotCount/时间/ACTIVE 标记）+ 行内重命名（Enter/blur 提交、Esc 取消、空值回退、maxLength 40）+ 操作按钮（打开/复制/更名/导出/删除/新建）+ unavailable 提示态 + busy 态。图标用 lucide-react，风格对齐 PromptPanel/ShotsPanel。
- [ ] 验证：`npm run build` 通过（组件被 App 引用前先保证可编译，可暂不接线）。

## Step 3 · App.jsx 接缝 S8 接线

- [ ] import 两个新模块。
- [ ] 状态区：`promptTabOpen` → `rightTab`（'inspector'|'prompt'|'projects'；同步改原两处页签按钮与 PromptPanel 条件渲染，行为不变）+ `activeProjectId / libraryEntries / libraryBusy / storeUnavailable / libraryVersion` + `quotaMissRef`。
- [ ] boot effect（一次）：按 design §4.1 迁移/回退/指针恢复；失败进 `storeUnavailable`。
- [ ] 自动保存 effect 双写（design §4.4）：库成功为准的状态文案；localStorage 失败首次 toast"已存入项目库"。
- [ ] 回调区：`flushCurrentProject / openProject / startNewProject（包装 resetProject，见 design §4.3）/ duplicateProject / renameProject / deleteProject（window.confirm）/ exportProject（从条目 data 导出，文件名规则同 saveProject）/ importProjectFile（loadProject 改造：新 id 入库+切换，内部复用 applyProjectSnapshot）`。
- [ ] 页签区挂第三页签「项目」+ `<ProjectsPanel>`；顶栏「新建」改 `startNewProject`、「打开」改 `importProjectFile`、「保存」不变。
- [ ] 验证：`npm run build`；手工冒烟（见 Step 5 清单）。

## Step 4 · 样式 + 台账

- [ ] `src/styles.css` 末尾追加 `dg-projects-*` 类（面板/列表行/缩略图/操作按钮/busy 态），不改动任何既有规则。
- [ ] `docs/PATCHES.md` + `.trellis/spec/base-audit.md` 登记 S8（锚点清单=Step 3 各触点；新文件列明）。
- [ ] 验证：`git diff src/styles.css` 无删除行；`git diff src/App.jsx` 逐 hunk 对 S8 锚点。

## Step 5 · 验证与回归

- [ ] `npm run build`
- [ ] `node --test src/projects/projectStore.test.js`
- [ ] `node --test "src/diagram/**/*.test.js"`（136 基线）
- [ ] `node --test src/sliderNumber.test.js`（上期回归）
- [ ] 手工冒烟（开发服务器全新标签页，按 fork-discipline 回归注记执行）：
  1. 带旧 localStorage 工程首开 → 迁移正确；
  2. 新建 → 旧工程入库可开回（含 diagram 扩展：机位词/图层设置还原）；
  3. 复制/更名/删除（确认框）/导出；活动项目删除禁用；
  4. 刷新 → 回到活动项目；顶栏导入 JSON → 成库内新项目；
  5. DevTools → Application 临时清 localStorage（保留 IndexedDB）→ 刷新仍能从库恢复列表。
- [ ] 自检记录写入任务目录 self-check.md（命令输出摘要 + 冒烟结论）。

## 回滚点

- 任一步失败：`git checkout -- src/App.jsx src/styles.css && rm src/projects/`（新文件未提交前整体可弃）。
- 上线后回滚：直接部署旧构建；localStorage 缓存键兼容旧版，IndexedDB 残留无副作用。

## 审查门

- trellis-check 按 PRD 验收清单 + 接缝合规 + 竞态（boot/双写/切换 flush 顺序）复核后方可提交。
