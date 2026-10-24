# Self-check 记录（2026-10-24）

## 验证命令

- `npm run build` — 通过（chunk-size 警告为上游既有）
- `node --test src/projects/projectStore.test.js` — 19/19 通过
- `node --test "src/diagram/**/*.test.js"` — 136/136 通过（回归基线保持）
- `node --test src/sliderNumber.test.js` — 11/11 通过（上期回归）

## trellis-check 修复的缺陷（4 处）

1. startNewProject/importProjectFile 的 50ms setTimeout 注册读 latestProjectRef 存在竞态（主线程拥塞时可能把旧工程数据注册到新 id）→ 改为确定性的 pendingRegistrationId effect（与 latestProjectRef 提交同批次、按定义顺序后执行）。
2. renameProject 对非活动项目重命名时无条件 flush，导致活动项目 updatedAt 被刷新、列表排序抖动 → flush 收窄到活动 id。
3. duplicateProject 复制活动项目可能拿到 ≤900ms 旧数据 → 活动项目先 flush。
4. exportProject 导出活动项目同理 → 活动项目先 flush。

## 浏览器冒烟（IAB 全新标签页 + npm run dev，2026-10-24）

1. ✅ 首开迁移：默认工程自动入项目库（1 PROJECT，未命名场景，ACTIVE）。
2. ✅ Inspector 改物体名"冒烟A" → 时间轴轨道与机位标签牌同步（S6 功能联动正常）。
3. ✅ 面板「新建」→ 2 PROJECTS：新工程 ACTIVE 且内容重置（人物·主角）；旧工程（含冒烟A）完整保留、可打开。
4. ✅ 刷新页面 → 回到活动项目（指针恢复正确，时间轴仍为人物·主角）。
5. ✅ 打开旧工程 → 内容完整还原（冒烟A 回到时间轴），ACTIVE 切换、打开/删除禁用态正确。
6. ✅ 面板底部存储隔离与原版兼容提示文案正常。

## 待人工/课堂验证项

- 大工程（>5MB GLB）localStorage 配额失败降级提示（逻辑已审查，需真实大工程触发）。
- 导出 JSON 用线上原版 MONOFORM 打开（格式与旧导出完全一致，代码层面已核对）。
- 隐私模式（IndexedDB 禁用）降级路径（逻辑已审查）。
- 复制/更名/删除确认框的点击手感（删除禁用规则已在冒烟中验证）。

## 已知残留（记录，不修）

- 悬空指针 + IDB 打开 >900ms 的极端时序下，首次自动保存可能在死 id 下写出一条幽灵条目（可手动删除，无数据损失）。
- makeEntryFromProject 每次 upsert 刷新 createdAt（字段未展示，无影响）。
