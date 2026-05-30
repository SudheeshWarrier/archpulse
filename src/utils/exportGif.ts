import { buildPlaybackVisualState } from './autoGenerate'
import type { AnimationStep } from '../types'

const NODE_TAGS = new Set(['rect', 'circle', 'ellipse'])
const EDGE_TAGS = new Set(['path', 'line', 'polyline'])

function parseSvgSize(svg: string): { width: number; height: number } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  const svgEl = doc.querySelector('svg')
  if (!svgEl) return { width: 560, height: 320 }

  const viewBox = svgEl.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[,\s]+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: parts[2], height: parts[3] }
    }
  }

  const width = parseFloat(svgEl.getAttribute('width') || '0')
  const height = parseFloat(svgEl.getAttribute('height') || '0')
  return {
    width: Number.isFinite(width) && width > 0 ? width : 560,
    height: Number.isFinite(height) && height > 0 ? height : 320
  }
}

function isEdgeElement(el: Element): boolean {
  return EDGE_TAGS.has(el.tagName.toLowerCase())
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ensureSvgFrameStyles(svgString: string, playbackState: ReturnType<typeof buildPlaybackVisualState>) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = doc.querySelector('svg')
  if (!svgEl) return svgString

  const seenHighlightSet = new Set(playbackState.seenHighlight)
  const seenFlowSet = new Set(playbackState.seenFlow)
  const currentHighlightSet = new Set(playbackState.currentHighlight)
  const currentFlowSet = new Set(playbackState.currentFlow)

  const shapes = Array.from(svgEl.querySelectorAll('[data-arch-id]'))
  shapes.forEach((shape) => {
    const id = shape.getAttribute('data-arch-id')
    if (!id) return

    const isCurrentHighlight = currentHighlightSet.has(id)
    const isSeenHighlight = seenHighlightSet.has(id)
    const isCurrentFlow = currentFlowSet.has(id)
    const isSeenFlow = seenFlowSet.has(id)

    const style: string[] = []
    const tag = shape.tagName.toLowerCase()
    const isEdge = isEdgeElement(shape)

    if (isEdge) {
      const geom = shape as SVGGeometryElement
      try {
        const length = geom.getTotalLength()
        if (Number.isFinite(length) && length > 0) {
          style.push(`stroke-dasharray: ${length}`)
          style.push(`stroke-dashoffset: ${isCurrentFlow ? length : isSeenFlow ? 0 : length}`)
          style.push('transition: none')
        }
      } catch {
        // ignore
      }
      if (isCurrentFlow) {
        style.push('opacity: 1')
      } else if (isSeenFlow) {
        style.push('opacity: 0.75')
      } else {
        style.push('opacity: 0.18')
      }
    } else {
      if (isCurrentHighlight) {
        style.push('opacity: 1')
        style.push('filter: drop-shadow(0 0 12px rgba(217, 26, 58, 0.5))')
      } else if (isSeenHighlight) {
        style.push('opacity: 0.85')
      } else {
        style.push('opacity: 0.2')
      }
    }

    const existingStyle = shape.getAttribute('style') || ''
    shape.setAttribute('style', `${existingStyle};${style.join(';')}`)
  })

  const serializer = new XMLSerializer()
  return serializer.serializeToString(svgEl)
}

function buildScaledImageData(svgString: string, width: number, height: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to create canvas context'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0, width, height)
      const pixels = ctx.getImageData(0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(pixels)
    }
    image.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    image.src = url
  })
}

function blendToWhite(r: number, g: number, b: number, a: number) {
  const alpha = a / 255
  return {
    r: Math.round(r * alpha + 255 * (1 - alpha)),
    g: Math.round(g * alpha + 255 * (1 - alpha)),
    b: Math.round(b * alpha + 255 * (1 - alpha))
  }
}

function buildPalette(frames: ImageData[], maxColors = 256) {
  const counts = new Map<string, number>()
  frames.forEach((frame) => {
    const data = frame.data
    for (let i = 0; i < data.length; i += 4) {
      const rgba = blendToWhite(data[i], data[i + 1], data[i + 2], data[i + 3])
      const key = `${rgba.r},${rgba.g},${rgba.b}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  })

  const entries = [...counts.entries()] as [string, number][]
  entries.sort((a, b) => b[1] - a[1])
  const palette = entries.slice(0, maxColors).map(([key]) => key.split(',').map(Number) as [number, number, number])

  if (palette.length === 0) {
    palette.push([255, 255, 255])
  }

  const paletteSize = 1 << Math.ceil(Math.log2(Math.max(2, palette.length)))
  while (palette.length < paletteSize) {
    palette.push([255, 255, 255])
  }

  return palette
}

function findNearestColorIndex(palette: [number, number, number][], r: number, g: number, b: number) {
  let nearest = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i += 1) {
    const [pr, pg, pb] = palette[i]
    const dr = pr - r
    const dg = pg - g
    const db = pb - b
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      nearest = i
    }
  }
  return nearest
}

function pixelsToIndices(frame: ImageData, palette: [number, number, number][]) {
  const indices = new Uint8Array(frame.width * frame.height)
  const data = frame.data
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const rgba = blendToWhite(data[i], data[i + 1], data[i + 2], data[i + 3])
    const key = `${rgba.r},${rgba.g},${rgba.b}`
    const matchIndex = palette.findIndex((color) => color[0] === rgba.r && color[1] === rgba.g && color[2] === rgba.b)
    indices[p] = matchIndex >= 0 ? matchIndex : findNearestColorIndex(palette, rgba.r, rgba.g, rgba.b)
  }
  return indices
}

function writeBytes(output: number[], bytes: number[]) {
  for (const byte of bytes) output.push(byte & 0xff)
}

function writeString(output: number[], value: string) {
  for (let i = 0; i < value.length; i += 1) output.push(value.charCodeAt(i))
}

function lzwEncode(minCodeSize: number, data: Uint8Array) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  const dict = new Map<string, number>()

  const output: number[] = []
  let bitBuffer = 0
  let bitCount = 0

  const pushCode = (code: number) => {
    bitBuffer |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff)
      bitBuffer >>= 8
      bitCount -= 8
    }
  }

  const flushBits = () => {
    if (bitCount > 0) {
      output.push(bitBuffer & 0xff)
      bitBuffer = 0
      bitCount = 0
    }
  }

  let prefix = `${data[0]}`
  pushCode(clearCode)

  for (let i = 1; i <= data.length; i += 1) {
    const current = i < data.length ? `${data[i]}` : null
    const combined = current !== null ? `${prefix},${current}` : null

    if (combined !== null && dict.has(combined)) {
      prefix = combined
      continue
    }

    const code = dict.has(prefix) ? dict.get(prefix)! : Number(prefix)
    pushCode(code)

    if (combined !== null) {
      dict.set(combined, nextCode)
      nextCode += 1
      if (nextCode === (1 << codeSize) && codeSize < 12) {
        codeSize += 1
      }
      prefix = current!
    }
  }

  pushCode(endCode)
  flushBits()
  return new Uint8Array(output)
}

function subBlocks(data: Uint8Array) {
  const blocks: number[] = []
  let offset = 0
  while (offset < data.length) {
    const blockSize = Math.min(255, data.length - offset)
    blocks.push(blockSize)
    for (let i = 0; i < blockSize; i += 1) {
      blocks.push(data[offset + i])
    }
    offset += blockSize
  }
  blocks.push(0)
  return new Uint8Array(blocks)
}

class GifEncoder {
  private output: number[]
  private width: number
  private height: number

  constructor(width: number, height: number, palette: [number, number, number][], loop = 0) {
    this.output = []
    this.width = width
    this.height = height
    this.writeHeader()
    this.writeLSD(palette.length)
    this.writePalette(palette)
    this.writeNetscape(loop)
  }

  private writeHeader() {
    writeString(this.output, 'GIF89a')
  }

  private writeLSD(paletteSize: number) {
    writeBytes(this.output, [this.width & 0xff, (this.width >> 8) & 0xff, this.height & 0xff, (this.height >> 8) & 0xff])
    const gctFlag = 1 << 7
    const colorRes = (7 & 0x7) << 4
    const sortFlag = 0
    const sizeOfGCT = Math.log2(paletteSize) - 1
    writeBytes(this.output, [gctFlag | colorRes | sortFlag | sizeOfGCT])
    writeBytes(this.output, [0, 0])
  }

  private writePalette(palette: [number, number, number][]) {
    palette.forEach(([r, g, b]) => writeBytes(this.output, [r, g, b]))
  }

  private writeNetscape(loop: number) {
    writeBytes(this.output, [0x21, 0xff, 0x0b])
    writeString(this.output, 'NETSCAPE2.0')
    writeBytes(this.output, [0x03, 0x01, loop & 0xff, (loop >> 8) & 0xff, 0x00])
  }

  addFrame(indices: Uint8Array, delay: number) {
    writeBytes(this.output, [0x21, 0xf9, 0x04, 0x04, delay & 0xff, (delay >> 8) & 0xff, 0x00, 0x00])
    writeBytes(this.output, [0x2c, 0x00, 0x00, 0x00, 0x00])
    writeBytes(this.output, [this.width & 0xff, (this.width >> 8) & 0xff, this.height & 0xff, (this.height >> 8) & 0xff])
    writeBytes(this.output, [0x00])
    writeBytes(this.output, [8])
    const compressed = lzwEncode(8, indices)
    const blocks = subBlocks(compressed)
    writeBytes(this.output, Array.from(blocks))
  }

  finish() {
    writeBytes(this.output, [0x3b])
    return new Uint8Array(this.output)
  }
}

export async function exportAnimatedGif(svg: string, steps: AnimationStep[]) {
  if (!svg || steps.length === 0) {
    throw new Error('No animation available to export.')
  }

  const { width, height } = parseSvgSize(svg)
  const maxSize = 760
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const targetWidth = clamp(Math.round(width * scale), 1, 1080)
  const targetHeight = clamp(Math.round(height * scale), 1, 1080)

  const frames: ImageData[] = []
  for (let i = 0; i < steps.length; i += 1) {
    const playbackState = buildPlaybackVisualState(steps, i)
    const frameSvg = ensureSvgFrameStyles(svg, playbackState)
    const frameData = await buildScaledImageData(frameSvg, targetWidth, targetHeight)
    frames.push(frameData)
  }

  const palette = buildPalette(frames)
  const encoder = new GifEncoder(targetWidth, targetHeight, palette)

  frames.forEach((frame, index) => {
    const indices = pixelsToIndices(frame, palette)
    encoder.addFrame(indices, steps[index]?.durationMs ?? 1200)
  })

  const gifBytes = encoder.finish()
  const blob = new Blob([gifBytes], { type: 'image/gif' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'animation.gif'
  link.click()
  URL.revokeObjectURL(link.href)
}
