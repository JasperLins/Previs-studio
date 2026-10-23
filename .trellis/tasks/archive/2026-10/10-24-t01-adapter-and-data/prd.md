> 录入自开发文档包（T00 文档落位）。本任务处于 planning：启动前按工作流完善 prd/design/implement 与 jsonl 上下文；本文件当前为原始规格的忠实拷贝。

# T01 · 适配层与 diagram 数据

**目标**：建立唯一耦合点与数据扩展，后续所有功能只面对适配层模型。
**依赖**：T00。**期次**：P0。

## 范围

1. 新建 `src/diagram/stateAdapter`：输入上游状态（objects/camera/shots/selectedId 等引用与写回回调），输出我们的数据模型（对象视图、机位视图、当前镜头视图），并提供写回位置/朝向的方法（内部仍调上游既有状态更新与历史栈）。
2. diagram 扩展字段：按 product-spec 第 3 节定义默认值与 normalize 补齐；在 App.jsx 工程 normalize/保存处透传（接缝 S5，登记 PATCHES）。
3. 适配层与 diagram 数据处理配单测（含老工程无 diagram 字段的补齐用例）。

## 验收

- [ ] diagram 内模块除 stateAdapter 外，无一处直接引用上游状态字段名
- [ ] 老工程打开不报错且 diagram 被补齐默认值；保存后重开字段不丢失
- [ ] 带 diagram 的工程用原版打开不报错
- [ ] 单测通过

## 验收自检记录（2026-10-24）

- [x] diagram 内模块除 stateAdapter 外无上游字段名：红线 grep（objectKeyframes/characterKeyframes/bodyType/poseTime/joints，排除 test 与 stateAdapter.js）为空；check 子代理对 App.jsx diff 逐行核对仅含 design §1 六触点。
- [x] 老工程打开不报错且 diagram 补齐默认值、保存重开不丢失：浏览器实测（独立 dev server）——T00 时代旧代码存的工程（无 diagram）加载后自动保存出现 5 个契约键；加对象 3→4、撤销 4→3；刷新重载后 diagram 5 键存活；全程 console 错误收集器为空。
- [x] 带 diagram 的工程用原版打开不报错：结构保证（原版 normalizeProjectData 的 `...data` 展开原样携带 diagram 且无消费者），留观项。
- [x] 单测通过：`node --test "src/diagram/**/*.test.js"` 30/30；`npm run build` 通过。

实现载体：commit cd0196f（工作）+ 232b4b8（任务档案与 spec 注记）。
