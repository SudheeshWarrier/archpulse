import { ArchElement, ElementType } from '../types'

const NODE_TAGS = new Set(['rect', 'circle', 'ellipse'])
const EDGE_TAGS = new Set(['path', 'line', 'polyline'])
const ALL_SHAPE_TAGS = new Set([...NODE_TAGS, ...EDGE_TAGS])

function parseViewBox(svgEl: Element): { w: number; h: number } {
  const vb = svgEl.getAttribute('viewBox')
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { w: parts[2], h: parts[3] }
    }
  }
  return {
    w: parseFloat(svgEl.getAttribute('width') || '1000') || 1000,
    h: parseFloat(svgEl.getAttribute('height') || '1000') || 1000
  }
}

function elementArea(el: Element): number {
  const tag = el.tagName.toLowerCase()
  if (tag === 'rect') {
    return Math.abs(parseFloat(el.getAttribute('width') || '0') * parseFloat(el.getAttribute('height') || '0'))
  }
  if (tag === 'circle') {
    const r = parseFloat(el.getAttribute('r') || '0')
    return Math.PI * r * r
  }
  if (tag === 'ellipse') {
    const rx = parseFloat(el.getAttribute('rx') || '0')
    const ry = parseFloat(el.getAttribute('ry') || '0')
    return Math.PI * rx * ry
  }
  try {
    const box = (el as SVGGraphicsElement).getBBox()
    return Math.abs(box.width * box.height)
  } catch {
    return 0
  }
}

function isBackground(el: Element, viewArea: number): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'rect') return false
  const area = elementArea(el)
  return area > viewArea * 0.45
}

function isTooSmall(el: Element, viewArea: number): boolean {
  const area = elementArea(el)
  const minArea = viewArea * 0.00005
  return area > 0 && area < minArea
}

function hasStroke(el: Element): boolean {
  const stroke = (el.getAttribute('stroke') || '').toLowerCase()
  if (stroke && stroke !== 'none') return true
  const style = el.getAttribute('style') || ''
  return /stroke\s*:\s*(?!none)[^;]+/i.test(style)
}

function isDecorativeEdge(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'path') return false
  if (hasStroke(el)) return false
  const fill = (el.getAttribute('fill') || '').toLowerCase()
  if (fill && fill !== 'none') return true
  const style = el.getAttribute('style') || ''
  return /fill\s*:\s*(?!none)[^;]+/i.test(style)
}

export function parseSVG(svgString: string): { svg: string; elements: Record<string, ArchElement> } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  const elements: Record<string, ArchElement> = {}
  let counter = 0

  const svgEl = doc.querySelector('svg')
  if (!svgEl) return { svg: svgString, elements: {} }

  const { w, h } = parseViewBox(svgEl)
  const viewArea = w * h

  function walk(el: Element) {
    const tag = el.tagName.toLowerCase()

    if (ALL_SHAPE_TAGS.has(tag)) {
      const interactive =
        !isBackground(el, viewArea) && !isTooSmall(el, viewArea) && !isDecorativeEdge(el)

      if (interactive) {
        const type: ElementType = NODE_TAGS.has(tag) ? 'node' : 'edge'
        const id = `arch-${tag}-${++counter}`
        el.setAttribute('data-arch-id', id)
        elements[id] = { id, type, domSelector: `[data-arch-id="${id}"]`, interactive: true }
      } else {
        el.setAttribute('data-arch-skip', 'true')
      }
      return
    }

    for (const child of Array.from(el.children)) walk(child)
  }

  walk(svgEl)

  const serializer = new XMLSerializer()
  const newSvg = serializer.serializeToString(svgEl)
  return { svg: newSvg, elements }
}
