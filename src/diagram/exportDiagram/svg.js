// 机位图导出（T07）：状态 → SVG（白底、符号、标签、图例、比例尺、镜头名标题）。
// 纯函数：输入中性视图形状，输出 SVG 字符串；不依赖 DOM/three（node --test 可跑）。
// 世界→画布：北（-Z）朝上；SVG y 向下 → svgY = oy + (maxZ - wz) * s。

import { footprintOf, isThinWall, poseVariant, doorHingeArc } from '../symbols/geometry.js'
import { horizontalFovDeg, coneLengthMeters } from '../gizmos/frustum.js'
import { pickScaleBar } from '../topView.js'

const W = 1600
const H = 1131
const MARGIN = 64
const TITLE_H = 56
const LEGEND_W = 236
const GREEN = '#22c55e'
const ORANGE = '#f97316'
const INK = '#3f3b33'
const GRID_MAJOR = '#e3e0d6'
const GRID_MINOR = '#f1efe8'

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function svgPos(object) {
  const p = Array.isArray(object?.position) ? object.position : [object?.x || 0, 0, object?.z || 0]
  return { x: Number.isFinite(p[0]) ? p[0] : 0, z: Number.isFinite(p[2]) ? p[2] : 0 }
}

export function buildShotDiagramSvg(input) {
  const objects = Array.isArray(input?.objects) ? input.objects : []
  const camera = input?.camera || {}
  const ghosts = Array.isArray(input?.ghosts) ? input.ghosts : []
  const layers = input?.layers || {}
  const axis = input?.axis || null
  const gazes = Array.isArray(input?.gazes) ? input.gazes : []
  const cameraTrack = Array.isArray(input?.cameraTrack) ? input.cameraTrack : []
  const objectTracks = Array.isArray(input?.objectTracks) ? input.objectTracks : []
  const shotName = input?.shotName || '镜头'
  const projectName = input?.projectName || ''
  const letter = input?.letter || 'A'
  const shotSize = input?.shotSize || ''
  const warned = Boolean(input?.warned)

  // ---- 取景范围：对象 + 机位 + 幽灵 + 轴线/路径端点，外扩 1.5m ----
  const pts = []
  for (const o of objects) { const p = svgPos(o); pts.push([p.x, p.z]) }
  const cam = svgPos(camera); pts.push([cam.x, cam.z])
  for (const g of ghosts) pts.push([Number(g.x) || 0, Number(g.z) || 0])
  if (axis) { pts.push([axis.a.x, axis.a.z], [axis.b.x, axis.b.z]) }
  for (const t of objectTracks) for (const p of t.points || []) pts.push([p.x, p.z])
  for (const k of cameraTrack) { const p = svgPos(k); pts.push([p.x, p.z]) }
  let minX = -6, maxX = 6, minZ = -6, maxZ = 6
  if (pts.length) {
    minX = Math.min(...pts.map(p => p[0])) - 1.5; maxX = Math.max(...pts.map(p => p[0])) + 1.5
    minZ = Math.min(...pts.map(p => p[1])) - 1.5; maxZ = Math.max(...pts.map(p => p[1])) + 1.5
  }
  const availW = W - MARGIN * 2 - LEGEND_W
  const availH = H - MARGIN * 2 - TITLE_H
  const s = Math.min(availW / Math.max(0.5, maxX - minX), availH / Math.max(0.5, maxZ - minZ))
  const ox = MARGIN + (availW - (maxX - minX) * s) / 2
  const oy = MARGIN + TITLE_H + (availH - (maxZ - minZ) * s) / 2
  const X = x => ox + (x - minX) * s
  const Y = z => oy + (maxZ - z) * s
  const out = []
  const add = markup => out.push(markup)

  // ---- 白底 + 边框 ----
  add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="PingFang SC, Microsoft YaHei, sans-serif">`)
  add(`<rect width="${W}" height="${H}" fill="#ffffff"/>`)
  add(`<rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#d8d4ca" stroke-width="1"/>`)

  // ---- 标题 ----
  add(`<text x="${MARGIN}" y="${MARGIN - 8}" font-size="24" font-weight="700" fill="${INK}">${esc(projectName ? projectName + ' · ' : '')}${esc(shotName)} 机位图</text>`)

  // ---- 网格（1m 主 / 0.5m 次，可关） ----
  if (layers.grid !== false) {
    for (let gx = Math.ceil(minX * 2) / 2; gx <= maxX; gx += 0.5) {
      const major = Math.abs(gx - Math.round(gx)) < 1e-6
      add(`<line x1="${X(gx).toFixed(1)}" y1="${Y(minZ).toFixed(1)}" x2="${X(gx).toFixed(1)}" y2="${Y(maxZ).toFixed(1)}" stroke="${major ? GRID_MAJOR : GRID_MINOR}" stroke-width="1"/>`)
    }
    for (let gz = Math.ceil(minZ * 2) / 2; gz <= maxZ; gz += 0.5) {
      const major = Math.abs(gz - Math.round(gz)) < 1e-6
      add(`<line x1="${X(minX).toFixed(1)}" y1="${Y(gz).toFixed(1)}" x2="${X(maxX).toFixed(1)}" y2="${Y(gz).toFixed(1)}" stroke="${major ? GRID_MAJOR : GRID_MINOR}" stroke-width="1"/>`)
    }
  }

  // ---- 对象符号 ----
  for (const o of objects) {
    const p = svgPos(o)
    const yaw = Array.isArray(o.rotation) ? (Number(o.rotation[1]) || 0) : (Number(o.yaw) || 0)
    const cx = X(p.x), cy = Y(p.z)
    if (o.type === 'person') {
      const variant = poseVariant(o.pose)
      const r = variant === 'crouch' ? 13 : 17
      const color = o.color || '#555653'
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      add(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="none" stroke="${color}" stroke-width="2"/>`)
      add(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="#333"/>`)
      add(`<line x1="${(cx + fx * r).toFixed(1)}" y1="${(cy + fz * -1 * r * 0 + fz * r).toFixed(1)}" x2="${(cx + fx * (r + 8)).toFixed(1)}" y2="${(cy + fz * (r + 8)).toFixed(1)}" stroke="${color}" stroke-width="2"/>`)
      if (variant === 'sit') add(`<path d="M ${(cx - 10).toFixed(1)} ${(cy + 10).toFixed(1)} A 14 14 0 0 1 ${(cx + 10).toFixed(1)} ${(cy + 10).toFixed(1)}" fill="none" stroke="${color}" stroke-width="2"/>`)
      if (variant === 'crouch') add(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.5" fill="${color}"/>`)
      if (variant === 'walk') {
        for (let i = 1; i <= 3; i++) {
          const bx = cx - fx * (r + 3 + i * 5), by = cy - fz * (r + 3 + i * 5)
          add(`<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(bx - fx * 4).toFixed(1)}" y2="${(by - fz * 4).toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`)
        }
      }
      if (layers.labels !== false) {
        add(`<text x="${cx.toFixed(1)}" y="${(cy + r + 20).toFixed(1)}" font-size="12" text-anchor="middle" fill="${INK}">${esc(o.name)}</text>`)
      }
      continue
    }
    const fp = footprintOf(o)
    if (!fp) continue
    const w = fp.w * s, d = fp.d * s
    const thin = o.type === 'box' && isThinWall(o.scale)
    const rot = -yaw * 180 / Math.PI // 世界 yaw（逆时针）→ 屏幕（y 向下，顺时针为正）
    const g0 = Math.abs(rot) < 0.5 ? '' : `<g transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">`
    const g1 = g0 ? '</g>' : ''
    add(g0)
    if (o.type === 'door') {
      const arc = doorHingeArc(fp.w, fp.d)
      add(`<line x1="${(cx - fp.w / 2 * s).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + fp.w / 2 * s).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${INK}" stroke-width="2"/>`)
      add(`<path d="M ${(cx - fp.w / 2 * s).toFixed(1)} ${cy.toFixed(1)} A ${(fp.w * s).toFixed(1)} ${(fp.w * s).toFixed(1)} 0 0 1 ${(cx - fp.w / 2 * s + fp.w * s * 0.71).toFixed(1)} ${(cy - fp.w * s * 0.71).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1"/>`)
      void arc
    } else if (thin) {
      // 墙：双线（间距取足迹厚与 3px 下限），两端收口
      const off = Math.max(3, d / 2)
      add(`<line x1="${(cx - w / 2).toFixed(1)}" y1="${(cy - off).toFixed(1)}" x2="${(cx + w / 2).toFixed(1)}" y2="${(cy - off).toFixed(1)}" stroke="${INK}" stroke-width="1.5"/>`)
      add(`<line x1="${(cx - w / 2).toFixed(1)}" y1="${(cy + off).toFixed(1)}" x2="${(cx + w / 2).toFixed(1)}" y2="${(cy + off).toFixed(1)}" stroke="${INK}" stroke-width="1.5"/>`)
      add(`<line x1="${(cx - w / 2).toFixed(1)}" y1="${(cy - off).toFixed(1)}" x2="${(cx - w / 2).toFixed(1)}" y2="${(cy + off).toFixed(1)}" stroke="${INK}" stroke-width="1"/>`)
      add(`<line x1="${(cx + w / 2).toFixed(1)}" y1="${(cy - off).toFixed(1)}" x2="${(cx + w / 2).toFixed(1)}" y2="${(cy + off).toFixed(1)}" stroke="${INK}" stroke-width="1"/>`)
    } else if (o.type === 'window') {
      // 窗三线：间距下限 3px
      const off = Math.max(3, d / 2)
      for (const dy of [-off, 0, off]) {
        add(`<line x1="${(cx - w / 2).toFixed(1)}" y1="${(cy + dy).toFixed(1)}" x2="${(cx + w / 2).toFixed(1)}" y2="${(cy + dy).toFixed(1)}" stroke="${INK}" stroke-width="1"/>`)
      }
    } else {
      add(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - d / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${d.toFixed(1)}" fill="none" stroke="#8f897c" stroke-width="1.5"/>`)
      if (o.type === 'chair') add(`<line x1="${(cx - w / 2).toFixed(1)}" y1="${(cy - d / 2).toFixed(1)}" x2="${(cx + w / 2).toFixed(1)}" y2="${(cy - d / 2).toFixed(1)}" stroke="#8f897c" stroke-width="3"/>`)
    }
    add(g1)
  }

  // ---- 轴线（虚线 + 两端延长 1m） ----
  if (layers.axis !== false && axis) {
    const dx = axis.b.x - axis.a.x, dz = axis.b.z - axis.a.z
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len, uz = dz / len
    const ax0 = axis.a.x - ux, az0 = axis.a.z - uz
    const bx0 = axis.b.x + ux, bz0 = axis.b.z + uz
    add(`<line x1="${X(ax0).toFixed(1)}" y1="${Y(az0).toFixed(1)}" x2="${X(bx0).toFixed(1)}" y2="${Y(bz0).toFixed(1)}" stroke="#8f897c" stroke-width="1.5" stroke-dasharray="6 4"/>`)
  }

  // ---- 视线（蓝虚线：有目标止于目标，无目标沿前向 1.2m） ----
  if (layers.sight !== false) {
    for (const g of gazes) {
      const tx = g.target ? g.target.x : g.x - Math.sin(g.yaw || 0) * 1.2
      const tz = g.target ? g.target.z : g.z - Math.cos(g.yaw || 0) * 1.2
      add(`<line x1="${X(g.x).toFixed(1)}" y1="${Y(g.z).toFixed(1)}" x2="${X(tx).toFixed(1)}" y2="${Y(tz).toFixed(1)}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 4"/>`)
    }
  }

  // ---- 路径（黑折线 + 序号 + 末端箭头） ----
  if (layers.paths !== false) {
    const drawTrack = (points, key) => {
      if (!Array.isArray(points) || points.length < 2) return
      const sorted = points.slice().sort((a, b) => a.frame - b.frame)
      add(`<polyline points="${sorted.map(p2 => `${X(p2.x).toFixed(1)},${Y(p2.z).toFixed(1)}`).join(' ')}" fill="none" stroke="#33322e" stroke-width="1.5"/>`)
      sorted.forEach((p2, i) => {
        add(`<circle cx="${X(p2.x).toFixed(1)}" cy="${Y(p2.z).toFixed(1)}" r="8" fill="#33322e"/>`)
        add(`<text x="${X(p2.x).toFixed(1)}" y="${(Y(p2.z) + 3).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">${i + 1}</text>`)
      })
      void key
    }
    drawTrack(cameraTrack.map(k => ({ frame: k.frame, x: svgPos(k).x, z: svgPos(k).z })), 'camera')
    for (const t of objectTracks) drawTrack(t.points, t.id)
  }

  // ---- 幽灵机位 ----
  if (layers.ghosts !== false) {
    for (const g of ghosts) add(`<g opacity="0.4">${cameraMark(X(g.x), Y(g.z), Number(g.yaw) || 0, '#9ca3af')}</g>`)
    for (const g of ghosts) add(`<text x="${(X(g.x) + 14).toFixed(1)}" y="${(Y(g.z) - 10).toFixed(1)}" font-size="10" fill="#6b7280">${esc(g.shotName)}</text>`)
  }

  // ---- 当前机位：符号 + 视锥 + 标签牌 ----
  if (layers.frustum !== false) {
    const color = warned ? ORANGE : GREEN
    const hfov = horizontalFovDeg(camera.focalLength)
    const cone = coneLengthMeters(camera, objects, hfov, null)
    const yaw = Array.isArray(camera.rotation) ? (Number(camera.rotation[1]) || 0) : 0
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
    const half = (hfov * Math.PI / 180) / 2
    const e1 = [cam.x + (-Math.sin(yaw - half)) * cone, cam.z + (-Math.cos(yaw - half)) * cone]
    const e2 = [cam.x + (-Math.sin(yaw + half)) * cone, cam.z + (-Math.cos(yaw + half)) * cone]
    add(`<path d="M ${X(cam.x).toFixed(1)} ${Y(cam.z).toFixed(1)} L ${X(e1[0]).toFixed(1)} ${Y(e1[1]).toFixed(1)} A ${(cone * s).toFixed(1)} ${(cone * s).toFixed(1)} 0 0 1 ${X(e2[0]).toFixed(1)} ${Y(e2[1]).toFixed(1)} Z" fill="${color}" fill-opacity="0.12" stroke="none"/>`)
    for (const e of [e1, e2]) add(`<line x1="${X(cam.x).toFixed(1)}" y1="${Y(cam.z).toFixed(1)}" x2="${X(e[0]).toFixed(1)}" y2="${Y(e[1]).toFixed(1)}" stroke="${color}" stroke-opacity="0.5" stroke-width="1"/>`)
    add(cameraMark(X(cam.x), Y(cam.z), yaw, color))
    void fx; void fz
    const plate = `<rect x="${(X(cam.x) + 12).toFixed(1)}" y="${(Y(cam.z) - 58).toFixed(1)}" width="118" height="46" rx="4" fill="${warned ? ORANGE : '#1e3a8a'}"/>`
    add(plate)
    add(`<text x="${(X(cam.x) + 20).toFixed(1)}" y="${(Y(cam.z) - 42).toFixed(1)}" font-size="12" font-weight="700" fill="#fff">Cam ${esc(letter)}</text>`)
    add(`<text x="${(X(cam.x) + 20).toFixed(1)}" y="${(Y(cam.z) - 28).toFixed(1)}" font-size="11" fill="#fff">${esc(shotSize || '—')} · ${Math.round(Number(camera.focalLength) || 42)}mm</text>`)
  }

  // ---- 方向标 / 比例尺 / 图例 ----
  add(`<g transform="translate(${W - MARGIN - 44}, ${MARGIN + 4})"><circle r="15" fill="none" stroke="#8f897c" stroke-width="1"/><path d="M 0 -11 L 4 4 L 0 1 L -4 4 Z" fill="#4b6a8f"/><text y="-18" font-size="13" font-weight="700" text-anchor="middle" fill="${INK}">N</text><text y="30" font-size="9" text-anchor="middle" fill="#8f897c">北 · -Z</text></g>`)
  const worldPerPx = 1 / s
  const bar = pickScaleBar(worldPerPx)
  if (bar.px > 0) {
    const bx = MARGIN + LEGEND_W + 24, by = H - MARGIN + 6
    add(`<line x1="${bx}" y1="${by}" x2="${bx + bar.px}" y2="${by}" stroke="${INK}" stroke-width="2"/><line x1="${bx}" y1="${by - 5}" x2="${bx}" y2="${by + 5}" stroke="${INK}" stroke-width="2"/><line x1="${bx + bar.px}" y1="${by - 5}" x2="${bx + bar.px}" y2="${by + 5}" stroke="${INK}" stroke-width="2"/><text x="${bx + bar.px / 2}" y="${by - 8}" font-size="11" text-anchor="middle" fill="${INK}">${bar.meters} m</text>`)
  }
  const legend = [
    ['人物', `<circle r="7" fill="none" stroke="#555653" stroke-width="2"/><circle r="2.5" fill="#333"/>`],
    ['机位与视锥', `<rect x="-7" y="-4" width="14" height="8" fill="${GREEN}"/>`],
    ['幽灵机位', `<g opacity="0.4"><rect x="-7" y="-4" width="14" height="8" fill="#9ca3af"/></g>`],
    ['轴线', `<line x1="-14" x2="14" stroke="#8f897c" stroke-width="1.5" stroke-dasharray="6 4"/>`],
    ['视线', `<line x1="-14" x2="14" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 4"/>`],
    ['走位路径', `<line x1="-14" x2="14" stroke="#33322e" stroke-width="1.5"/><circle r="4" fill="#33322e"/>`],
    ['门（开启弧）', `<line x1="-12" x2="6" stroke="${INK}" stroke-width="2"/><path d="M -12 0 A 18 18 0 0 1 1 -13" fill="none" stroke="${INK}" stroke-width="1"/>`],
  ]
  const ly0 = H - MARGIN - legend.length * 22 - 20
  add(`<rect x="${MARGIN}" y="${ly0}" width="${LEGEND_W}" height="${legend.length * 22 + 14}" fill="#faf9f5" stroke="#d8d4ca"/>`)
  legend.forEach(([label, sample], i) => {
    const yy = ly0 + 24 + i * 22
    add(`<g transform="translate(${MARGIN + 26}, ${yy - 4})">${sample}</g>`)
    add(`<text x="${MARGIN + 52}" y="${yy}" font-size="11" fill="${INK}">${label}</text>`)
  })

  add('</svg>')
  return out.join('\n')
}

function cameraMark(x, y, yaw, color) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
  const rx = -fz, rz = fx // 画面右向（屏幕系）
  const L = 7, Wd = 4, tip = 5
  const p = (dx, dy) => `${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}`
  // 屏幕系：前向 (fx, fz) 在 y 向下坐标系中 z 取反 → 屏幕 f = (fx, -fz)
  const fxs = fx, fys = -fz
  const rxs = rx, rys = -rz
  const corner = (a, b) => p(fxs * a + rxs * b, fys * a + rys * b)
  return `<polygon points="${corner(L, -Wd)} ${corner(L, Wd)} ${corner(L + tip, 0)} ${corner(-L, Wd)} ${corner(-L, -Wd)}" fill="${color}"/>`
}
