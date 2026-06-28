/* ─────────────────────────────────────────────────────────────
 * 小番茄图片混淆 / 解混淆
 * 算法来源：https://singularpoint.cn/hideImg1.html
 *
 * 核心：按 generalized Hilbert（gilbert）空间填充曲线重排像素，
 * 再用黄金比例偏移打乱/复原。输出 JPEG 最高质量，方便 QQ 直接发图。
 * ───────────────────────────────────────────────────────────── */

import sharp from 'sharp'

const PHI_OFFSET = (Math.sqrt(5) - 1) / 2
const MAX_PIXELS = 4096 * 4096 // 防止超大图把低配服务器内存打爆

export function gilbert2d (width, height) {
  const coordinates = []
  if (width >= height) generate2d(0, 0, width, 0, 0, height, coordinates)
  else generate2d(0, 0, 0, height, width, 0, coordinates)
  return coordinates
}

function generate2d (x, y, ax, ay, bx, by, coordinates) {
  const w = Math.abs(ax + ay)
  const h = Math.abs(bx + by)

  const dax = Math.sign(ax), day = Math.sign(ay)
  const dbx = Math.sign(bx), dby = Math.sign(by)

  if (h === 1) {
    for (let i = 0; i < w; i++) {
      coordinates.push([x, y])
      x += dax
      y += day
    }
    return
  }

  if (w === 1) {
    for (let i = 0; i < h; i++) {
      coordinates.push([x, y])
      x += dbx
      y += dby
    }
    return
  }

  let ax2 = Math.floor(ax / 2), ay2 = Math.floor(ay / 2)
  let bx2 = Math.floor(bx / 2), by2 = Math.floor(by / 2)

  const w2 = Math.abs(ax2 + ay2)
  const h2 = Math.abs(bx2 + by2)

  if (2 * w > 3 * h) {
    if ((w2 % 2) && (w > 2)) {
      ax2 += dax
      ay2 += day
    }
    generate2d(x, y, ax2, ay2, bx, by, coordinates)
    generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by, coordinates)
  } else {
    if ((h2 % 2) && (h > 2)) {
      bx2 += dbx
      by2 += dby
    }
    generate2d(x, y, bx2, by2, ax2, ay2, coordinates)
    generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2, coordinates)
    generate2d(
      x + (ax - dax) + (bx2 - dbx),
      y + (ay - day) + (by2 - dby),
      -bx2,
      -by2,
      -(ax - ax2),
      -(ay - ay2),
      coordinates
    )
  }
}

async function loadRaw (input) {
  const img = sharp(input, { limitInputPixels: MAX_PIXELS })
  const meta = await img.metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (!width || !height) throw new Error('图片尺寸读取失败')
  if (width * height > MAX_PIXELS) throw new Error(`图片太大啦，最多支持 ${MAX_PIXELS} 像素以内`)
  return img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

/** mode: 'encrypt' 混淆；'decrypt' 解混淆 */
export async function hideImgTransform (input, mode = 'decrypt') {
  const { data, info } = await loadRaw(input)
  const { width, height } = info
  const total = width * height
  const out = Buffer.allocUnsafe(total * 4)
  const curve = gilbert2d(width, height)
  const offset = Math.round(PHI_OFFSET * total)
  const decrypt = mode === 'decrypt'

  for (let i = 0; i < total; i++) {
    const oldPos = curve[i]
    const newPos = curve[(i + offset) % total]
    const oldP = 4 * (oldPos[0] + oldPos[1] * width)
    const newP = 4 * (newPos[0] + newPos[1] * width)

    if (decrypt) data.copy(out, oldP, newP, newP + 4)
    else data.copy(out, newP, oldP, oldP + 4)
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .jpeg({ quality: 100, mozjpeg: true })
    .toBuffer()
}
