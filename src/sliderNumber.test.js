// node --test src/sliderNumber.test.js 直接可跑（node 内置 runner，零依赖）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSliderDraft, snapToStep } from './sliderNumber.js'

test('parseSliderDraft：合法整数原样返回', () => {
  assert.equal(parseSliderDraft('42', { min: 18, max: 120, step: 1, unit: ' mm' }), 42)
})

test('parseSliderDraft：小数对齐 step 网格（1.23 步进 0.05 → 1.25）', () => {
  assert.equal(parseSliderDraft('1.23', { min: 0.1, max: 5, step: 0.05 }), 1.25)
})

test('parseSliderDraft：边界值含端点', () => {
  assert.equal(parseSliderDraft('-180', { min: -180, max: 180, step: 1, unit: '°' }), -180)
  assert.equal(parseSliderDraft('180', { min: -180, max: 180, step: 1, unit: '°' }), 180)
  assert.equal(parseSliderDraft('0.1', { min: 0.1, max: 5, step: 0.05 }), 0.1)
})

test('parseSliderDraft：超出上界还原 null（还原而非 clamp）', () => {
  assert.equal(parseSliderDraft('5.5', { min: 0.1, max: 5, step: 0.05 }), null)
  assert.equal(parseSliderDraft('121', { min: 18, max: 120, step: 1, unit: ' mm' }), null)
})

test('parseSliderDraft：低于下界还原 null', () => {
  assert.equal(parseSliderDraft('0', { min: 0.1, max: 5, step: 0.05 }), null)
  assert.equal(parseSliderDraft('-200', { min: -180, max: 180, step: 1, unit: '°' }), null)
})

test('parseSliderDraft：空串与纯空白还原 null', () => {
  assert.equal(parseSliderDraft('', { min: -30, max: 30, step: 0.05 }), null)
  assert.equal(parseSliderDraft('   ', { min: -30, max: 30, step: 0.05 }), null)
  assert.equal(parseSliderDraft(null, { min: -30, max: 30, step: 0.05 }), null)
})

test('parseSliderDraft：无法解析的输入还原 null', () => {
  assert.equal(parseSliderDraft('abc', { min: -30, max: 30, step: 0.05 }), null)
  assert.equal(parseSliderDraft('-', { min: -30, max: 30, step: 0.05 }), null)
  assert.equal(parseSliderDraft('1.2.3', { min: -30, max: 30, step: 0.05 }), null)
})

test('parseSliderDraft：单位子串全部剥除后再解析', () => {
  assert.equal(parseSliderDraft('90°', { min: -180, max: 180, step: 1, unit: '°' }), 90)
  assert.equal(parseSliderDraft('50%', { min: 0, max: 100, step: 1, unit: '%' }), 50)
  assert.equal(parseSliderDraft('42 mm', { min: 18, max: 120, step: 1, unit: ' mm' }), 42)
  assert.equal(parseSliderDraft('°', { min: -180, max: 180, step: 1, unit: '°' }), null)
})

test('parseSliderDraft：负值合法且按网格取整', () => {
  assert.equal(parseSliderDraft('-90', { min: -180, max: 180, step: 1, unit: '°' }), -90)
  assert.equal(parseSliderDraft('-12.34', { min: -30, max: 30, step: 0.05 }), -12.35)
})

test('snapToStep：消除浮点累计误差（0.1+0.2 风格）', () => {
  assert.equal(snapToStep(0.1 + 0.2, 0.1), 0.3)
  assert.equal(snapToStep(0.30000000000000004, 0.1), 0.3)
})

test('snapToStep：step 非法（零/负/NaN）时按 1 对齐', () => {
  assert.equal(snapToStep(2.6, 0), 3)
  assert.equal(snapToStep(2.4, Number.NaN), 2)
  assert.equal(snapToStep(2.4, -1), 2)
})
