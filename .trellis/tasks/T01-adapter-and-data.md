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
