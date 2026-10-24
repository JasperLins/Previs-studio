// node --test src/projects/projectStore.test.js 直接可跑（node 内置 runner，零依赖；仅测纯函数，不 mock IndexedDB）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createProjectId, fallbackProjectId, makeEntryFromProject, relativeTime, uniqueProjectName } from './projectStore.js'

test('makeEntryFromProject：正常工程派生 name/shotCount/cover', () => {
  const entry = makeEntryFromProject('id-1', { settings: { name: '课堂样例' }, shots: [{ thumbnail: '' }, { thumbnail: 'data:image/jpeg;base64,abc' }, { thumbnail: 'data:image/jpeg;base64,def' }] }, 123)
  assert.equal(entry.id, 'id-1')
  assert.equal(entry.name, '课堂样例')
  assert.equal(entry.createdAt, 123)
  assert.equal(entry.updatedAt, 123)
  assert.equal(entry.shotCount, 3)
  assert.equal(entry.cover, 'data:image/jpeg;base64,abc')
  assert.equal(entry.data.settings.name, '课堂样例')
})

test('makeEntryFromProject：settings.name 缺省/空白回退未命名场景', () => {
  assert.equal(makeEntryFromProject('a', { shots: [] }, 1).name, '未命名场景')
  assert.equal(makeEntryFromProject('b', { settings: {}, shots: [] }, 1).name, '未命名场景')
  assert.equal(makeEntryFromProject('c', { settings: { name: '   ' }, shots: [] }, 1).name, '未命名场景')
})

test('makeEntryFromProject：名称超 40 字符截断', () => {
  assert.equal(makeEntryFromProject('a', { settings: { name: 'x'.repeat(50) }, shots: [] }, 1).name.length, 40)
})

test('makeEntryFromProject：shots 非数组时 shotCount=0、cover 为空', () => {
  const entry = makeEntryFromProject('a', { settings: { name: 't' }, shots: null }, 1)
  assert.equal(entry.shotCount, 0)
  assert.equal(entry.cover, '')
})

test('makeEntryFromProject：无任何缩略图时 cover 为空', () => {
  assert.equal(makeEntryFromProject('a', { settings: { name: 't' }, shots: [{ thumbnail: '' }, {}] }, 1).cover, '')
})

test('makeEntryFromProject：data 为 null 时仍产出可用条目', () => {
  const entry = makeEntryFromProject('a', null, 5)
  assert.equal(entry.name, '未命名场景')
  assert.equal(entry.shotCount, 0)
  assert.equal(entry.cover, '')
  assert.deepEqual(entry.data, {})
})

test('uniqueProjectName：不重名原样返回（忽略首尾空白）', () => {
  assert.equal(uniqueProjectName(['A 工程', 'B 工程'], '新工程'), '新工程')
  assert.equal(uniqueProjectName([], ' 新工程 '), '新工程')
})

test('uniqueProjectName：重名追加递增后缀', () => {
  assert.equal(uniqueProjectName(['工程'], '工程'), '工程 2')
  assert.equal(uniqueProjectName(['工程', '工程 2'], '工程'), '工程 3')
})

test('uniqueProjectName：大小写不敏感判重', () => {
  assert.equal(uniqueProjectName(['demo'], 'DEMO'), 'DEMO 2')
})

test('uniqueProjectName：超长基名给后缀留位', () => {
  const long = '长'.repeat(40)
  const result = uniqueProjectName([long], long)
  assert.equal(result.length, 40)
  assert.equal(result, `${'长'.repeat(38)} 2`)
})

test('uniqueProjectName：desired 为空回退默认名并去重', () => {
  assert.equal(uniqueProjectName([], ''), '未命名场景')
  assert.equal(uniqueProjectName(['未命名场景'], ''), '未命名场景 2')
})

test('relativeTime：60 秒内显示刚刚', () => {
  const now = new Date(2026, 9, 24, 15, 0, 0).getTime()
  assert.equal(relativeTime(now, now - 59 * 1000), '刚刚')
  assert.equal(relativeTime(now, now), '刚刚')
})

test('relativeTime：1 小时内显示 N 分钟前', () => {
  const now = new Date(2026, 9, 24, 15, 0, 0).getTime()
  assert.equal(relativeTime(now, now - 60 * 1000), '1 分钟前')
  assert.equal(relativeTime(now, now - 59 * 60 * 1000), '59 分钟前')
})

test('relativeTime：今天一小时前显示 HH:mm', () => {
  const now = new Date(2026, 9, 24, 15, 0, 0).getTime()
  assert.equal(relativeTime(now, new Date(2026, 9, 24, 1, 5).getTime()), '01:05')
  assert.equal(relativeTime(now, new Date(2026, 9, 24, 0, 0).getTime()), '00:00')
})

test('relativeTime：跨天/跨月显示 MM-DD HH:mm', () => {
  const now = new Date(2026, 9, 24, 1, 30).getTime()
  assert.equal(relativeTime(now, new Date(2026, 9, 23, 23, 59).getTime()), '10-23 23:59')
  assert.equal(relativeTime(new Date(2026, 11, 1, 9, 30).getTime(), new Date(2025, 0, 2, 8, 5).getTime()), '01-02 08:05')
})

test('relativeTime：非法或未来时间返回空串', () => {
  const now = new Date(2026, 9, 24, 15, 0, 0).getTime()
  assert.equal(relativeTime(now, Number.NaN), '')
  assert.equal(relativeTime(Number.NaN, now), '')
  assert.equal(relativeTime(now, undefined), '')
  assert.equal(relativeTime(now, now + 1000), '')
})

test('createProjectId：非空字符串且互不相同', () => {
  const first = createProjectId()
  const second = createProjectId()
  assert.equal(typeof first, 'string')
  assert.ok(first.length > 0)
  assert.notEqual(first, second)
})

test('createProjectId：randomUUID 可用时为 UUID 形态', () => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') return
  assert.match(createProjectId(), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})

test('fallbackProjectId：时间戳+随机形态且互不相同', () => {
  const first = fallbackProjectId()
  const second = fallbackProjectId()
  assert.match(first, /^p-[0-9a-z]+-[0-9a-z]+$/)
  assert.notEqual(first, second)
})
