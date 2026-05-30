import { ArchElement, ElementType } from '../types'

const NODE_SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'polygon', 'path'])
const EDGE_SHAPE_TAGS = new Set(['path', 'line', 'polyline'])

const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'polygon', 'path', 'line', 'polyline'])

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

function getStyleProperty(el: Element, prop: string): string | null {
  const style = el.getAttribute('style') || ''
  const match = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i'))
  return match ? match[1].trim() : null
}

function getAttributeValue(el: Element, attr: string): string | null {
  return el.getAttribute(attr) ?? getStyleProperty(el, attr)
}

function hasStroke(el: Element): boolean {
  const stroke = (getAttributeValue(el, 'stroke') || '').toLowerCase()
  return !!stroke && stroke !== 'none'
}

function hasFill(el: Element): boolean {
  const fill = (getAttributeValue(el, 'fill') || '').toLowerCase()
  return fill !== 'none' && fill !== ''
}

function isFilledShape(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (!NODE_SHAPE_TAGS.has(tag)) return false
  return hasFill(el)
}

function isEdgeShape(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (!EDGE_SHAPE_TAGS.has(tag)) return false
  const fill = (getAttributeValue(el, 'fill') || '').toLowerCase()
  return fill === 'none' && hasStroke(el)
}

function parseNumbers(value: string | null): number[] {
  if (!value) return []
  return value
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((part) => parseFloat(part))
    .filter(Number.isFinite)
}

function getPathInfo(el: Element): { path: string; start?: { x: number; y: number }; end?: { x: number; y: number } } {
  const tag = el.tagName.toLowerCase()

  if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') || '0')
    const y1 = parseFloat(el.getAttribute('y1') || '0')
    const x2 = parseFloat(el.getAttribute('x2') || '0')
    const y2 = parseFloat(el.getAttribute('y2') || '0')
    return {
      path: `M ${x1} ${y1} L ${x2} ${y2}`,
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 }
    }
  }

  if (tag === 'polyline') {
    const points = parseNumbers(el.getAttribute('points'))
    if (points.length < 4) {
      return { path: '' }
    }
    const coords = []
    for (let i = 0; i + 1 < points.length; i += 2) {
      coords.push(`${i === 0 ? 'M' : 'L'} ${points[i]} ${points[i + 1]}`)
    }
    return {
      path: coords.join(' '),
      start: { x: points[0], y: points[1] },
      end: { x: points[points.length - 2], y: points[points.length - 1] }
    }
  }

  if (tag === 'path') {
    const d = el.getAttribute('d') || ''
    const numbers = parseNumbers(d)
    if (numbers.length >= 2) {
      return {
        path: d,
        start: { x: numbers[0], y: numbers[1] },
        end:
          numbers.length >= 4
            ? { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] }
            : undefined
      }
    }
    return { path: d }
  }

  return { path: '' }
}

function getPosition(el: Element): { x: number; y: number } | null {
  const tag = el.tagName.toLowerCase()
  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') || '0')
    const y = parseFloat(el.getAttribute('y') || '0')
    return { x, y }
  }
  if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') || '0')
    const cy = parseFloat(el.getAttribute('cy') || '0')
    const r = parseFloat(el.getAttribute('r') || '0')
    return { x: cx - r, y: cy - r }
  }
  if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') || '0')
    const cy = parseFloat(el.getAttribute('cy') || '0')
    const rx = parseFloat(el.getAttribute('rx') || '0')
    const ry = parseFloat(el.getAttribute('ry') || '0')
    return { x: cx - rx, y: cy - ry }
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const points = parseNumbers(el.getAttribute('points'))
    if (points.length >= 2) {
      return { x: points[0], y: points[1] }
    }
  }
  if (tag === 'path') {
    const info = getPathInfo(el)
    return info.start ?? null
  }
  return null
}

function getLabel(group: Element): string {
  const textEl = group.querySelector('text')
  if (!textEl) return ''
  return textEl.textContent?.trim() ?? ''
}

function isBackgroundGroup(group: Element, viewArea: number): boolean {
  const shapeEls = Array.from(group.querySelectorAll('rect,circle,ellipse,polygon,path'))
  if (shapeEls.length === 0) return false
  for (const shape of shapeEls) {
    const tag = shape.tagName.toLowerCase()
    if (tag === 'rect' && hasFill(shape)) {
      const width = parseFloat(shape.getAttribute('width') || '0')
      const height = parseFloat(shape.getAttribute('height') || '0')
      if (width * height > viewArea * 0.45) {
        return true
      }
    }
  }
  return false
}

function stableGroupId(group: Element, type: ElementType, fallbackCounter: number): string {
  const cellId = group.getAttribute('data-cell-id') || group.getAttribute('data-node-id') || group.getAttribute('id')
  const base = cellId ? `arch-${type}-${cellId}` : `arch-${type}-${fallbackCounter}`
  return base.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_:.]/g, '')
}

interface ParsedNode {
  id: string
  type: 'node'
  shapeType: string
  label: string
  position: { x: number; y: number } | null
  element: Element
  metadata?: Record<string, string>
}

interface ParsedEdge {
  id: string
  type: 'edge'
  path: string
  stroke: {
    color?: string
    width?: string
    dasharray?: string
  }
  source?: { x: number; y: number }
  target?: { x: number; y: number }
  element: Element
  metadata?: Record<string, string>
}

interface ParsedDiagram {
  nodes: ParsedNode[]
  edges: ParsedEdge[]
}

export function parseDiagramElementsFromSvg(input: string | Document | Element): ParsedDiagram {
  let svgEl: SVGSVGElement | null = null
  if (typeof input === 'string') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(input, 'image/svg+xml')
    svgEl = doc.querySelector('svg')
  } else if (input instanceof Document) {
    svgEl = input.querySelector('svg')
  } else {
    svgEl = input.tagName.toLowerCase() === 'svg' ? (input as SVGSVGElement) : input.querySelector('svg')
  }
  if (!svgEl) return { nodes: [], edges: [] }
  return parseDiagramElements(svgEl)
}

function parseDiagramElements(svgEl: SVGSVGElement): ParsedDiagram {
  const groups = Array.from(svgEl.querySelectorAll('g'))
  const nodes: ParsedNode[] = []
  const edges: ParsedEdge[] = []
  let fallbackCounter = 0

  for (const group of groups) {
    const shapeEls = Array.from(group.querySelectorAll(Array.from(SHAPE_TAGS).join(',')))
    if (shapeEls.length === 0) continue

    const filledShapes = shapeEls.filter(isFilledShape)
    const edgeShapes = shapeEls.filter(isEdgeShape)
    const hasTextLabel = Boolean(group.querySelector('text'))

    if (isBackgroundGroup(group, parseFloat(svgEl.getAttribute('width') || '1000') * parseFloat(svgEl.getAttribute('height') || '1000') || 1000000)) {
      continue
    }

    if (filledShapes.length > 0) {
      const shape = filledShapes[0]
      const node: ParsedNode = {
        id: stableGroupId(group, 'node', ++fallbackCounter),
        type: 'node',
        shapeType: shape.tagName.toLowerCase(),
        label: getLabel(group),
        position: getPosition(shape),
        element: group,
        metadata: {}
      }
      if (group.getAttribute('data-cell-id')) {
        node.metadata!.dataCellId = group.getAttribute('data-cell-id')!
      }
      nodes.push(node)
      continue
    }

    if (edgeShapes.length > 0) {
      const edgeShape = edgeShapes[0]
      const pathInfo = getPathInfo(edgeShape)
      const edge: ParsedEdge = {
        id: stableGroupId(group, 'edge', ++fallbackCounter),
        type: 'edge',
        path: pathInfo.path,
        stroke: {
          color: getAttributeValue(edgeShape, 'stroke') || undefined,
          width: getAttributeValue(edgeShape, 'stroke-width') || undefined,
          dasharray: getAttributeValue(edgeShape, 'stroke-dasharray') || undefined
        },
        source: pathInfo.start,
        target: pathInfo.end,
        element: group,
        metadata: {}
      }
      if (group.getAttribute('data-cell-id')) {
        edge.metadata!.dataCellId = group.getAttribute('data-cell-id')!
      }
      edges.push(edge)
      continue
    }
  }

  return { nodes, edges }
}

export function parseSVG(svgString: string): { svg: string; elements: Record<string, ArchElement> } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  const elements: Record<string, ArchElement> = {}
  let counter = 0

  const svgEl = doc.querySelector('svg')
  if (!svgEl) return { svg: svgString, elements: {} }

  const parsed = parseDiagramElements(svgEl as SVGSVGElement)
  const usedIds = new Set<string>()

  for (const node of parsed.nodes) {
    let id = node.id
    while (usedIds.has(id)) {
      id = `${id}-${++counter}`
    }
    usedIds.add(id)
    if (!node.element.hasAttribute('data-arch-id')) {
      node.element.setAttribute('data-arch-id', id)
    }
    const selector = `[data-arch-id="${id}"]`
    elements[id] = { id, type: 'node', domSelector: selector, interactive: true }
  }

  for (const edge of parsed.edges) {
    let id = edge.id
    while (usedIds.has(id)) {
      id = `${id}-${++counter}`
    }
    usedIds.add(id)
    if (!edge.element.hasAttribute('data-arch-id')) {
      edge.element.setAttribute('data-arch-id', id)
    }
    const selector = `[data-arch-id="${id}"]`
    elements[id] = { id, type: 'edge', domSelector: selector, interactive: true }
  }

  const serializer = new XMLSerializer()
  const newSvg = serializer.serializeToString(svgEl)
  return { svg: newSvg, elements }
}
