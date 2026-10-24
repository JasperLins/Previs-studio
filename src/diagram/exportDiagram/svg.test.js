// 机位图导出结构断言（纯字符串检查，node --test）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildShotDiagramSvg } from './svg.js'

const person = (id, name, x, z, yaw, pose) => ({ id, name, type: 'person', position: [x, 0, z], rotation: [0, yaw, 0], scale: [1, 1.7, 1], pose, color: '#555653' })
const prop = (id, name, x, z, type = 'box', scale = [2, 1, 1]) => ({ id, name, type, position: [x, 0, z], rotation: [0, 0, 0], scale })

const baseInput = () => ({
  objects: [prop('w1', '墙', 0, -3, 'box', [4, 2.2, 0.2]), prop('d1', '门', 1, 2, 'door', [1.2, 2.2, 0.25]), prop('win', '窗', -2, 2, 'window', [1.5, 1.3, 0.22]), prop('c1', '椅', 2.5, 0, 'chair', [0.8, 1, 0.8]), person('p1', '奶奶', -1, 0, Math.PI, 'sit')],
  camera: { position: [3, 1.6, 4], rotation: [0, 0.6, 0], focalLength: 42, aspectRatio: '16:9' },
  ghosts: [{ shotId: 's2', shotName: '镜头 02', x: -3, z: -4, yaw: 0.3, focalLength: 42 }],
  axis: { a: { id: 'p1', x: -1, z: 0 }, b: { id: 'p2', x: 2, z: -1 } },
  gazes: [{ actorId: 'p1', actorName: '奶奶', x: -1, z: 0, yaw: Math.PI, target: { x: 1, z: 2 } }],
  cameraTrack: [{ frame: 0, position: [3, 1.6, 5], yaw: 0.6, focalLength: 42 }, { frame: 96, position: [3, 1.6, 2.5], yaw: 0.6, focalLength: 42 }],
  objectTracks: [{ id: 'p1', name: '奶奶', points: [{ frame: 0, x: -1, z: 0 }, { frame: 96, x: 0, z: -1 }] }],
  layers: { grid: true, labels: true, frustum: true, axis: true, sight: true, paths: true, ghosts: true },
  shotName: '镜头 01',
  projectName: '课堂示例',
  letter: 'A',
  shotSize: '中景',
})

test('机位图结构：白底/标题/图例/比例尺/方向标齐备', () => {
  const svg = buildShotDiagramSvg(baseInput())
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('fill="#ffffff"'))
  assert.ok(svg.includes('课堂示例 · 镜头 01 机位图'))
  assert.ok(svg.includes('图例') || svg.includes('人物'))
  assert.ok(svg.includes(' m') && svg.includes('北 · -Z'))
})
test('要素：人物符号/标签、门弧、窗三线、视锥、标签牌、幽灵、轴线、视线、路径序号', () => {
  const svg = buildShotDiagramSvg(baseInput())
  assert.ok(svg.includes('>奶奶<'), '人物标签')
  assert.ok(svg.includes(' A '), '门开启弧')
  assert.ok(svg.includes('Cam A'), '机位标签牌')
  assert.ok(svg.includes('中景 · 42mm'))
  assert.ok(svg.includes('镜头 02'), '幽灵名')
  assert.ok(svg.includes('stroke-dasharray="6 4"'), '轴线虚线')
  assert.ok(svg.includes('stroke-dasharray="4 4"'), '视线虚线')
  assert.ok(svg.includes('>1</text>') && svg.includes('>2</text>'), '路径序号')
  assert.ok(svg.includes('fill-opacity="0.12"'), '视锥填充')
})
test('图层开关：关 grid/labels/ghosts 时对应要素消失', () => {
  const input = baseInput()
  input.layers = { grid: false, labels: false, frustum: true, axis: true, sight: true, paths: true, ghosts: false }
  const svg = buildShotDiagramSvg(input)
  assert.ok(!svg.includes('#e3e0d6'), '无网格主线')
  assert.ok(!svg.includes('>奶奶<'), '无人物名标签')
  assert.ok(!svg.includes('镜头 02'), '无幽灵')
  assert.ok(svg.includes('Cam A'), '机位仍在')
})
test('越轴橙态与空输入兜底', () => {
  const warned = buildShotDiagramSvg({ ...baseInput(), warned: true })
  assert.ok(warned.includes('#f97316'))
  const empty = buildShotDiagramSvg({})
  assert.ok(empty.startsWith('<svg') && empty.includes('机位图'))
})
test('确定性：同输入同输出', () => {
  assert.equal(buildShotDiagramSvg(baseInput()), buildShotDiagramSvg(baseInput()))
})
