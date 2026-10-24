// 运动层（prompt-compiler §6）：把「录制内容」编译成话——机位运动推导 + 人物走位 + 动作切换 + 时长。
// 全部确定性判定（阈值：位移 0.3m / 水平角 8° / 焦距 5mm）；耗时 <2s 迅速、>4s 缓慢。

const MOVE_MIN = 0.3
const PAN_MIN_DEG = 8
const ZOOM_MIN_MM = 5
const SUBJECT_MOVE_MIN = 0.5

function finite3(v) {
  return Array.isArray(v) && v.length >= 3 && v.every(x => Number.isFinite(x)) ? v : null
}

function lerp(a, b, t) { return a + (b - a) * t }

// 在按帧升序的机位轨上取指定帧的机位（线性插值；帧外取端点）。
export function cameraAtFrame(track, frame) {
  const list = (Array.isArray(track) ? track : []).filter(k => k && Number.isFinite(Number(k.frame))).slice().sort((a, b) => a.frame - b.frame)
  if (!list.length) return null
  if (frame <= list[0].frame) return list[0]
  if (frame >= list[list.length - 1].frame) return list[list.length - 1]
  for (let i = 1; i < list.length; i++) {
    if (frame <= list[i].frame) {
      const a = list[i - 1]
      const b = list[i]
      const t = (frame - a.frame) / Math.max(1e-6, b.frame - a.frame)
      const pa = finite3(a.position)
      const pb = finite3(b.position)
      return {
        frame,
        position: pa && pb ? pa.map((v, j) => lerp(v, pb[j], t)) : (pa || pb),
        yaw: Number.isFinite(Number(a.yaw)) && Number.isFinite(Number(b.yaw)) ? lerp(a.yaw, b.yaw, t) : (a.yaw ?? b.yaw ?? 0),
        focalLength: Number.isFinite(Number(a.focalLength)) && Number.isFinite(Number(b.focalLength)) ? lerp(a.focalLength, b.focalLength, t) : (a.focalLength ?? b.focalLength ?? 42),
      }
    }
  }
  return list[list.length - 1]
}

function horizontalDeltaDeg(yawA, yawB) {
  let d = Math.abs((Number(yawB) || 0) - (Number(yawA) || 0)) * 180 / Math.PI
  while (d > 180) d = 360 - d
  return d
}

// 机位运动词。subjectStart/subjectEnd：主体（人或场景中心）首末帧 XZ（跟拍时主体在动，
// 推拉判定必须配对各自帧的位置；静止主体两参传同一点）。
export function cameraMotionWord(track, subjectStart, subjectEnd) {
  const subjectPos = subjectEnd || subjectStart
  const list = (Array.isArray(track) ? track : []).filter(k => k && Number.isFinite(Number(k.frame))).slice().sort((a, b) => a.frame - b.frame)
  if (list.length < 2) return { word: '固定镜头', detail: '' }
  const first = list[0]
  const last = list[list.length - 1]
  const pa = finite3(first.position)
  const pb = finite3(last.position)
  const moved = Math.hypot((pb?.[0] ?? 0) - (pa?.[0] ?? 0), (pb?.[2] ?? 0) - (pa?.[2] ?? 0)) >= MOVE_MIN
  const panDeg = horizontalDeltaDeg(first.yaw, last.yaw)
  const panned = panDeg >= PAN_MIN_DEG
  const zoomDelta = (Number(last.focalLength) || 42) - (Number(first.focalLength) || 42)
  const zoomed = Math.abs(zoomDelta) >= ZOOM_MIN_MM
  if (!moved && !panned && !zoomed) return { word: '固定镜头', detail: '' }

  let word = '固定镜头'
  let detail = ''
  const ps = subjectStart || subjectEnd
  const pe = subjectEnd || subjectStart
  const toSubjectStart = pa && ps ? Math.hypot(ps[0] - pa[0], ps[1] - pa[2]) : null
  const toSubjectEnd = pb && pe ? Math.hypot(pe[0] - pb[0], pe[1] - pb[2]) : null
  if (zoomed && !moved && !panned) {
    word = zoomDelta > 0 ? '变焦推近' : '变焦拉远' // 焦距变大 = 视场变窄 = 推近
  } else if (panned && !moved) {
    // 摇镜方向按画面移动方向：yaw 增大 → 视线逆时针（画面向右移）
    const dYaw = ((Number(last.yaw) || 0) - (Number(first.yaw) || 0) + Math.PI * 3) % (Math.PI * 2) - Math.PI
    word = dYaw > 0 ? '左摇' : '右摇'
    detail = `水平转约 ${Math.round(panDeg)}°`
  } else if (moved) {
    const approaching = Number.isFinite(toSubjectStart) && Number.isFinite(toSubjectEnd) && toSubjectEnd < toSubjectStart - MOVE_MIN
    const retreating = Number.isFinite(toSubjectStart) && Number.isFinite(toSubjectEnd) && toSubjectEnd > toSubjectStart + MOVE_MIN
    if (approaching && !panned) word = '推近'
    else if (retreating && !panned) word = '拉远'
    else {
      // 横移方向：位移在首帧机位右向（= (cos yaw, −sin yaw)，与 projection.js 同口径）上的投影
      const yaw = Number(first.yaw) || 0
      const rightX = Math.cos(yaw)
      const rightZ = -Math.sin(yaw)
      const dx = (pb?.[0] ?? 0) - (pa?.[0] ?? 0)
      const dz = (pb?.[2] ?? 0) - (pa?.[2] ?? 0)
      word = (dx * rightX + dz * rightZ) > 0 ? '右移跟拍' : '左移跟拍'
    }
  }
  return { word, detail }
}

// 耗时修饰：<2s 迅速、>4s 缓慢（否则空）。
export function paceWord(track, fps) {
  const list = (Array.isArray(track) ? track : []).filter(k => k && Number.isFinite(Number(k.frame))).slice().sort((a, b) => a.frame - b.frame)
  if (list.length < 2) return ''
  const seconds = (list[list.length - 1].frame - list[0].frame) / Math.max(1, Number(fps) || 24)
  if (seconds < 2) return '迅速'
  if (seconds > 4) return '缓慢'
  return ''
}

// 人物走位句：轨首末投影（screenX 档位词），位移 <0.5m 不出句。
// projectAt(frame) → 该帧主体归一化横向落点（由调用方闭包给出，含对应帧机位插值）。
export function subjectMotionPhrase(trackPoints, fps, projectAt) {
  const list = (Array.isArray(trackPoints) ? trackPoints : []).filter(p => p && Number.isFinite(p.frame)).slice().sort((a, b) => a.frame - b.frame)
  if (list.length < 2) return null
  const start = list[0]
  const end = list[list.length - 1]
  const moved = Math.hypot((end.x ?? 0) - (start.x ?? 0), (end.z ?? 0) - (start.z ?? 0)) >= SUBJECT_MOVE_MIN
  if (!moved) return null
  const sx = projectAt(start.frame)
  const ex = projectAt(end.frame)
  const from = Number.isFinite(sx) ? horizontalWord(sx) : ''
  const to = Number.isFinite(ex) ? horizontalWord(ex) : ''
  const seconds = (end.frame - start.frame) / Math.max(1, Number(fps) || 24)
  const pace = seconds > 4 ? '缓慢' : ''
  const span = from && to && from !== to ? `从画面${from}移动到画面${to}` : (from ? `在画面${from}向前移动` : '发生走位')
  return `${pace ? pace : ''}${span}`.trim()
}

function horizontalWord(screenX) {
  if (screenX < 0.25) return '左侧'
  if (screenX < 0.42) return '左中'
  if (screenX <= 0.58) return '中央'
  if (screenX <= 0.75) return '右中'
  return '右侧'
}

// 动作切换句：相邻姿势关键帧 poseLabel 变化 → 「第 X 秒{姿势}」。
export function poseChangePhrases(trackPoints, fps) {
  const list = (Array.isArray(trackPoints) ? trackPoints : []).filter(p => p && Number.isFinite(p.frame)).slice().sort((a, b) => a.frame - b.frame)
  const out = []
  let prevPose = null
  for (const p of list) {
    if (p.poseLabel && p.poseLabel !== prevPose) {
      if (prevPose !== null) out.push(`第 ${Math.max(1, Math.round(p.frame / Math.max(1, Number(fps) || 24)))} 秒转为${p.poseLabel}`)
      prevPose = p.poseLabel
    }
  }
  return out
}
