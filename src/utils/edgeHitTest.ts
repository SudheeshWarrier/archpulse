const SVG_NS = 'http://www.w3.org/2000/svg'
const HIT_STROKE_WIDTH = 22

const EDGE_TAGS = new Set(['line', 'path', 'polyline'])

export function isEdgeElement(el: Element): boolean {
  return EDGE_TAGS.has(el.tagName.toLowerCase())
}

function toSvgRoot(svg: SVGSVGElement, el: SVGGraphicsElement, x: number, y: number) {
  const pt = svg.createSVGPoint()
  pt.x = x
  pt.y = y
  const ctm = el.getCTM()
  return ctm ? pt.matrixTransform(ctm) : pt
}

function createRootHitLine(svg: SVGSVGElement, line: SVGLineElement): SVGLineElement {
  const p1 = toSvgRoot(svg, line, parseFloat(line.getAttribute('x1') || '0'), parseFloat(line.getAttribute('y1') || '0'))
  const p2 = toSvgRoot(svg, line, parseFloat(line.getAttribute('x2') || '0'), parseFloat(line.getAttribute('y2') || '0'))
  const hit = document.createElementNS(SVG_NS, 'line') as SVGLineElement
  hit.setAttribute('x1', String(p1.x))
  hit.setAttribute('y1', String(p1.y))
  hit.setAttribute('x2', String(p2.x))
  hit.setAttribute('y2', String(p2.y))
  return hit
}

function createRootHitPolyline(svg: SVGSVGElement, poly: SVGPolylineElement): SVGPolylineElement {
  const raw = (poly.getAttribute('points') ?? '').trim().split(/\s+/)
  const mapped = raw
    .map((pair) => pair.split(',').map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
    .map(([x, y]) => {
      const p = toSvgRoot(svg, poly, x, y)
      return `${p.x},${p.y}`
    })
  const hit = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement
  hit.setAttribute('points', mapped.join(' '))
  return hit
}

function createRootHitPath(svg: SVGSVGElement, path: SVGPathElement): SVGPathElement | null {
  const len = path.getTotalLength()
  if (!Number.isFinite(len) || len <= 0) return null

  const steps = Math.max(2, Math.ceil(len / 5))
  const parts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const p = path.getPointAtLength((len * i) / steps)
    const root = toSvgRoot(svg, path, p.x, p.y)
    parts.push(`${i === 0 ? 'M' : 'L'} ${root.x} ${root.y}`)
  }

  const hit = document.createElementNS(SVG_NS, 'path') as SVGPathElement
  hit.setAttribute('d', parts.join(' '))
  return hit
}

function styleHitElement(hit: SVGElement, id: string) {
  hit.setAttribute('data-arch-id', id)
  hit.setAttribute('data-arch-hit', 'true')
  hit.setAttribute('fill', 'none')
  hit.setAttribute('stroke', 'transparent')
  hit.setAttribute('stroke-width', String(HIT_STROKE_WIDTH))
  hit.setAttribute('stroke-linecap', 'round')
  hit.setAttribute('stroke-linejoin', 'round')
  hit.style.pointerEvents = 'stroke'
  hit.style.cursor = 'pointer'
}

/** Wide transparent overlays in root SVG space — works with nested draw.io transforms. */
export function injectEdgeHitAreas(container: HTMLElement): () => void {
  const svg = container.querySelector('svg') as SVGSVGElement | null
  if (!svg) return () => undefined

  svg.querySelector('.arch-hit-layer')?.remove()

  const hitLayer = document.createElementNS(SVG_NS, 'g')
  hitLayer.setAttribute('class', 'arch-hit-layer')
  hitLayer.setAttribute('aria-hidden', 'true')

  container.querySelectorAll('[data-arch-id]').forEach((node) => {
    if (node.hasAttribute('data-arch-hit')) return
    if (!isEdgeElement(node)) return

    const id = node.getAttribute('data-arch-id')
    if (!id) return

    const tag = node.tagName.toLowerCase()
    let hit: SVGElement | null = null

    if (tag === 'line') {
      hit = createRootHitLine(svg, node as SVGLineElement)
    } else if (tag === 'polyline') {
      hit = createRootHitPolyline(svg, node as SVGPolylineElement)
    } else if (tag === 'path') {
      hit = createRootHitPath(svg, node as SVGPathElement)
    }

    if (!hit) return
    styleHitElement(hit, id)
    hitLayer.appendChild(hit)
  })

  if (hitLayer.childNodes.length > 0) {
    svg.appendChild(hitLayer)
  }

  return () => hitLayer.remove()
}

export function pickArchElementId(container: HTMLElement, clientX: number, clientY: number): string | null {
  const hits = document.elementsFromPoint(clientX, clientY)
  let edgeId: string | null = null
  let nodeId: string | null = null

  for (const hit of hits) {
    if (!container.contains(hit)) continue
    const el = hit.closest('[data-arch-id]') as Element | null
    if (!el || el.hasAttribute('data-arch-skip')) continue
    const id = el.getAttribute('data-arch-id')
    if (!id) continue

    if (isEdgeElement(el) || el.hasAttribute('data-arch-hit')) {
      edgeId = id
      break
    }
    if (!nodeId) nodeId = id
  }

  if (edgeId) return edgeId

  const svg = container.querySelector('svg') as SVGSVGElement | null
  if (svg) {
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const inv = svg.getScreenCTM()?.inverse()
    if (inv) {
      const svgPt = pt.matrixTransform(inv)
      let nearest: { id: string; dist: number } | null = null

      container.querySelectorAll('[data-arch-id]').forEach((node) => {
        if (!isEdgeElement(node)) return
        const geom = node as SVGGeometryElement
        if (typeof geom.isPointInStroke !== 'function') return

        const prevWidth = geom.getAttribute('stroke-width')
        geom.setAttribute('stroke-width', String(HIT_STROKE_WIDTH))
        const inside = geom.isPointInStroke(svgPt)
        if (prevWidth) geom.setAttribute('stroke-width', prevWidth)
        else geom.removeAttribute('stroke-width')

        if (inside) {
          const id = node.getAttribute('data-arch-id')
          if (id) nearest = { id, dist: 0 }
        }
      })

      if (nearest) return nearest.id as string
    }
  }

  return nodeId
}
