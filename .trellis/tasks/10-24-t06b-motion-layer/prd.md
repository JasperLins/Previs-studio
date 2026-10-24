# T06b 提示词运动层与生成版输出

## Goal

录制内容运动描述（机位运动推导+人物走位+动作切换+时长）、自然语句化模板、生成版复制（P2，用户需求评审定案）

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.

## 验收自检记录（2026-10-24，需求来源：用户两轮评审）

- [x] 运动层描述「录制内容」：机位运动六型推导（固定/推近/拉远/左右摇/左右移跟拍/变焦推拉近，阈值 0.3m/8°/5mm + 节奏词 <2s 迅速 >4s 缓慢）单测逐型验证；人物走位（轨首末投影措辞，<0.5m 不出句）与动作切换（第 X 秒转为{姿势}）集成用例覆盖；时长「本镜 X 秒」。
- [x] 语句化模板：站位层电报体 → 自然语句（行走类「正在X」），既有十用例断言同步更新仍全过。
- [x] 双版输出：genText = 取景+运动+站位+场景+动作（剔除一致性层与（待填写）占位），集成用例断言；面板「复制生成版」按钮（浏览器实测 toast）。
- [x] 确定性不变：全部确定性推导，无随机/AI 润色；spec §6 先行落档。
- 过程修正 2 处实现笔误（横移方向/变焦方向符号），均有单测把守。

实现：motion.js（新）+ compile.js 集成 + App 接缝（cameraTrack/objectTracks/fps/duration）+ PromptPanel（运动行/复制生成版）。126/126 测试、build 过。全程主会话内联（quota 延续）。
