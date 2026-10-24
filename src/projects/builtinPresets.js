// 「课堂预设」内置清单（T11 · S8 延伸）：直接 import 仓库根 presets/ 的母版工程，
// 随应用打包分发——任何浏览器/机器无需手动选文件即可载入学习。
// 纯数据模块：不含任何工程逻辑，载入管线由 App 的 loadBuiltinPreset 回调执行。
// P1（04–07）放行后：在这里追加 import 与清单项即可。
import rainyBookstore from '../../presets/预设-01-雨夜书店内景.monoform.json'
import dialogueRoom from '../../presets/预设-02-双人对话通用内景.monoform.json'
import depthStreet from '../../presets/预设-03-透视纵深街道.monoform.json'

export const BUILTIN_PRESETS = [
  { id: 'builtin-01', label: '雨夜书店内景', data: rainyBookstore },
  { id: 'builtin-02', label: '双人对话通用内景', data: dialogueRoom },
  { id: 'builtin-03', label: '透视纵深街道', data: depthStreet },
]
