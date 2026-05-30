import { ArchElement } from '../types'

type Point = { x: number; y: number }
type Bounds = { x: number; y: number; width: number; height: number }

function parseNum(value: string | null, fallback = 0): number {
  const n = parseFloat(value ?? '')
  return Number.isFinite(n) ? n : fallback
}

function mountSvg(svgString: string): { svg: SVGSVGElement; cleanup: () => void } | null {
  if (typeof document === 'undefined') return null
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;'
  host.innerHTML = svgString
  const svg = host.querySelector('svg')
  if (!svg) return null
  document.body.appendChild(host)
  return { svg, cleanup: () => host.remove() }
}

function getViewBoxSize(svgEl: SVGSVGElement): { w: number; h: number } {
  const vb = svgEl.viewBox.baseVal
  if (vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height }
  return {
    w: parseNum(svgEl.getAttribute('width'), 1000),
    h: parseNum(svgEl.getAttribute('height'), 1000)
  }
}

function getCenterFromAttrs(el: Element): Point | null {
  const tag = el.tagName.toLowerCase()
  if (tag === 'rect') {
    const x = parseNum(el.getAttribute('x'))
    const y = parseNum(el.getAttribute('y'))
    const w = parseNum(el.getAttribute('width'))
    const h = parseNum(el.getAttribute('height'))
    return { x: x + w / 2, y: y + h / 2 }
  }
  if (tag === 'circle') {
    return { x: parseNum(el.getAttribute('cx')), y: parseNum(el.getAttribute('cy')) }
  }
  if (tag === 'ellipse') {
    return { x: parseNum(el.getAttribute('cx')), y: parseNum(el.getAttribute('cy')) }
  }
  return null
}

function getBounds(el: Element): Bounds | null {
  try {
    const box = (el as SVGGraphicsElement).getBBox()
    if (box.width >= 0 && box.height >= 0) {
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
  } catch {
    /* fall through */
  }
  const tag = el.tagName.toLowerCase()
  if (tag === 'rect') {
    return {
      x: parseNum(el.getAttribute('x')),
      y: parseNum(el.getAttribute('y')),
      width: parseNum(el.getAttribute('width')),
      height: parseNum(el.getAttribute('height'))
    }
  }
  if (tag === 'circle') {
    const r = parseNum(el.getAttribute('r'))
    const cx = parseNum(el.getAttribute('cx'))
    const cy = parseNum(el.getAttribute('cy'))
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
  }
  if (tag === 'ellipse') {
    const rx = parseNum(el.getAttribute('rx'))
    const ry = parseNum(el.getAttribute('ry'))
    const cx = parseNum(el.getAttribute('cx'))
    const cy = parseNum(el.getAttribute('cy'))
    return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
  }
  return null
}

function getEdgeEndpoints(el: Element): [Point, Point] | null {
  const tag = el.tagName.toLowerCase()

  if (tag === 'line') {
    return [
      { x: parseNum(el.getAttribute('x1')), y: parseNum(el.getAttribute('y1')) },
      { x: parseNum(el.getAttribute('x2')), y: parseNum(el.getAttribute('y2')) }
    ]
  }

  if (tag === 'path') {
    try {
      const path = el as SVGPathElement
      const len = path.getTotalLength()
      if (len <= 0) return null
      const start = path.getPointAtLength(0)
      const end = path.getPointAtLength(len)
      return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }]
    } catch {
      return null
    }
  }

  if (tag === 'polyline') {
    const points = (el.getAttribute('points') ?? '')
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
      .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
    if (points.length < 2) return null
    const first = points[0]
    const last = points[points.length - 1]
    return [{ x: first[0], y: first[1] }, { x: last[0], y: last[1] }]
  }

  return null
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pointInBounds(point: Point, bounds: Bounds, pad: number): boolean {
  return (
    point.x >= bounds.x - pad &&
    point.x <= bounds.x + bounds.width + pad &&
    point.y >= bounds.y - pad &&
    point.y <= bounds.y + bounds.height + pad
  )
}

function findNodeAtPoint(
  point: Point,
  nodes: { id: string; center: Point; bounds: Bounds | null }[],
  maxDist: number
): string | null {
  for (const node of nodes) {
    if (node.bounds && pointInBounds(point, node.bounds, maxDist * 0.35)) {
      return node.id
    }
  }

  let best: { id: string; dist: number } | null = null
  for (const node of nodes) {
    const dist = distance(point, node.center)
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { id: node.id, dist }
    }
  }
  return best?.id ?? null
}

export interface GraphEdge {
  edgeId: string
  from: string
  to: string
}

export function buildAdjacencyList(
  svgString: string,
  elements: Record<string, ArchElement>
): { edges: GraphEdge[]; adjacency: Map<string, GraphEdge[]>; unmatchedEdgeIds: string[] } {
  const mounted = mountSvg(svgString)
  if (!mounted) return { edges: [], adjacency: new Map(), unmatchedEdgeIds: [] }

  const { svg: svgEl, cleanup } = mounted
  try {
    const { w, h } = getViewBoxSize(svgEl)
    const maxDist = Math.max(80, Math.min(w, h) * 0.18)

    const nodeEntries = Object.values(elements)
      .filter((el) => el.type === 'node' && el.interactive !== false)
      .map((el) => {
        const dom = svgEl.querySelector(`[data-arch-id="${el.id}"]`)
        if (!dom) return null
        const bounds = getBounds(dom)
        const center = bounds
          ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
          : getCenterFromAttrs(dom)
        return center ? { id: el.id, center, bounds } : null
      })
      .filter(Boolean) as { id: string; center: Point; bounds: Bounds | null }[]

    const graphEdges: GraphEdge[] = []
    const matchedEdgeIds = new Set<string>()

    for (const el of Object.values(elements)) {
      if (el.type !== 'edge' || el.interactive === false) continue
      const dom = svgEl.querySelector(`[data-arch-id="${el.id}"]`)
      if (!dom) continue
      const endpoints = getEdgeEndpoints(dom)
      if (!endpoints) continue

      const [start, end] = endpoints
      let from = findNodeAtPoint(start, nodeEntries, maxDist)
      let to = findNodeAtPoint(end, nodeEntries, maxDist)

      if (from && to && from === to) {
        to = null
      }

      if ((!from || !to) && from !== to) {
        const altFrom = findNodeAtPoint(end, nodeEntries, maxDist)
        const altTo = findNodeAtPoint(start, nodeEntries, maxDist)
        if (altFrom && altTo && altFrom !== altTo) {
          from = altFrom
          to = altTo
        }
      }

      if (from && to && from !== to) {
        graphEdges.push({ edgeId: el.id, from, to })
        matchedEdgeIds.add(el.id)
      }
    }

    const adjacency = new Map<string, GraphEdge[]>()
    for (const edge of graphEdges) {
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, [])
      adjacency.get(edge.from)!.push(edge)
      if (!adjacency.has(edge.to)) adjacency.set(edge.to, [])
      adjacency.get(edge.to)!.push({ edgeId: edge.edgeId, from: edge.to, to: edge.from })
    }

    const unmatchedEdgeIds = Object.values(elements)
      .filter((el) => el.type === 'edge' && el.interactive !== false && !matchedEdgeIds.has(el.id))
      .map((el) => el.id)

    return { edges: graphEdges, adjacency, unmatchedEdgeIds }
  } finally {
    cleanup()
  }
}
