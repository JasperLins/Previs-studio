// 术语映射表（prompt-compiler.md §2 定版——改动需评审，禁止随手调档）。
// 全部纯函数；输入输出均为基本类型，不依赖任何运行时状态。

// 画面横向 9 档：screenX 为归一化横向落点（0 左边缘 … 1 右边缘）。
export function horizontalTier(screenX) {
  const x = Number(screenX)
  if (!Number.isFinite(x)) return { key: 'unknown', label: '位置不明' }
  if (x < 0) return { key: 'out-left', label: '出画（左）', out: true, side: 'left' }
  if (x <= 0.08) return { key: 'left-edge', label: '左边缘' }
  if (x <= 0.25) return { key: 'left', label: '左侧' }
  if (x <= 0.42) return { key: 'left-mid', label: '左中' }
  if (x <= 0.58) return { key: 'center', label: '中央' }
  if (x <= 0.75) return { key: 'right-mid', label: '右中' }
  if (x <= 0.92) return { key: 'right', label: '右侧' }
  if (x <= 1) return { key: 'right-edge', label: '右边缘' }
  return { key: 'out-right', label: '出画（右）', out: true, side: 'right' }
}

// 景深层（相对主体距离 d）：<0.6d 前景；0.6–1.4d 中景；>1.4d 后景。
export function depthTier(distance, subjectDistance) {
  const d = Number(distance)
  const s = Number(subjectDistance)
  if (!Number.isFinite(d) || !Number.isFinite(s) || s <= 0) return { key: 'unknown', label: '' }
  if (d < 0.6 * s) return { key: 'foreground', label: '前景' }
  if (d <= 1.4 * s) return { key: 'midground', label: '中景' }
  return { key: 'background', label: '后景' }
}

// 朝向相对镜头 5 档：θ 为人物朝向与「人物→机位」方向的夹角（度）。
export function orientationTier(thetaDeg) {
  const t = Number(thetaDeg)
  if (!Number.isFinite(t) || t < 0 || t > 180) return { key: 'unknown', label: '' }
  if (t <= 30) return { key: 'front', label: '正面' }
  if (t <= 60) return { key: 'three-quarter-front', label: '四分之三侧面' }
  if (t <= 120) return { key: 'profile', label: '侧面' }
  if (t <= 150) return { key: 'three-quarter-back', label: '四分之三背面' }
  return { key: 'back', label: '背面' }
}

// 景别 6 档：h = 主体在画面中的高度占比（0–1）。
export function shotSizeTier(h) {
  const v = Number(h)
  if (!Number.isFinite(v) || v <= 0) return { key: 'unknown', label: '' }
  if (v > 0.8) return { key: 'closeup', label: '特写' }
  if (v > 0.5) return { key: 'medium-closeup', label: '近景' }
  if (v > 0.3) return { key: 'medium', label: '中近景' }
  if (v > 0.15) return { key: 'medium-shot', label: '中景' }
  if (v > 0.08) return { key: 'full', label: '全景' }
  return { key: 'wide', label: '远景' }
}

// 距离措辞：一位小数「约 X 米」。
export function distanceWording(meters) {
  const m = Number(meters)
  if (!Number.isFinite(m) || m < 0) return ''
  return `约 ${Math.round(m * 10) / 10} 米`
}

// 视线关系（prompt-compiler §2）：mutual = 双方朝向互指（各自与连线夹角 <25°）。
export function gazeRelation(mutual, aToB, bToA, aName, bName, aGaze, bGaze) {
  if (aGaze === 'target' || bGaze === 'target') return null // 有注视目标时由 landmark 句处理
  if (mutual) return `${aName}与${bName}对视`
  if (aToB && !bToA) return `${aName}看向${bName}`
  if (bToA && !aToB) return `${bName}看向${aName}`
  return null
}
