// SVG → PNG（浏览器端）：Image 加载 data URL → canvas → Blob。
export function svgToPngBlob(svgString, scale = 2) {
  return new Promise((resolve, reject) => {
    const svg = svgString.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/)
    const w = Number(svg?.[1]) || 1600
    const h = Number(svg?.[2]) || 1131
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob 失败'))), 'image/png')
    }
    img.onerror = () => reject(new Error('SVG 加载失败'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
  })
}
