import {
  AnimationStep,
  ArchElement,
  EdgeAnimation,
  Graph,
  GraphEdge,
  MxCell,
  MxGraphModel,
  NodeAnimation,
  SuggestScope
} from '../types'
import { buildAdjacencyList, GraphEdge as LegacyGraphEdge } from './graphUtils'

function decodeHtmlEntities(value: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${value}</body>`, 'text/html')
  return doc.body.textContent?.trim() ?? ''
}

function extractLabel(value: string, fallback = ''): string {
  const cleaned = decodeHtmlEntities(value || '')
  const stripped = cleaned.replace(/<[^>]+>/g, '').trim()
  return stripped || fallback || 'Unlabelled'
}

function classifyStyle(style: string) {
  const lower = style.toLowerCase()
  return {
    isContainer: /swimlane|group/i.test(style),
    isDecorator: /text;/.test(style) && /fillcolor=none/.test(lower),
    shapeType: (style.match(/shape=([^;]+)/i) ?? [])[1] ?? 'rectangle'
  }
}

function stableArchId(type: 'node' | 'edge', cellId: string) {
  return `arch-${type}-${cellId}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_:.]/g, '')
}

function parseNum(value: string | null, fallback = 0): number {
  const n = parseFloat(value || '')
  return Number.isFinite(n) ? n : fallback
}

function parseMxGraph(svg: string): MxGraphModel | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')

  const decodeModelFromString = (source: string | null): Element | null => {
    if (!source) return null
    const decoded = decodeHtmlEntities(source.trim())
    const innerDoc = parser.parseFromString(decoded, 'application/xml')
    return innerDoc.querySelector('mxGraphModel')
  }

  let modelEl = doc.querySelector('mxGraphModel') || null

  if (!modelEl) {
    const rootSvg = doc.querySelector('svg')
    modelEl = decodeModelFromString(rootSvg?.getAttribute('content') || null)
  }

  if (!modelEl) {
    const diagram = doc.querySelector('diagram')
    if (diagram) {
      modelEl = decodeModelFromString(diagram.textContent || diagram.getAttribute('content') || null)
    }
  }

  if (!modelEl) return null

  const cells = new Map<string, MxCell>()
  modelEl.querySelectorAll('mxCell[id]').forEach((cell) => {
    const id = cell.getAttribute('id')
    if (!id || id === '0' || id === '1') return

    const isVertex = cell.getAttribute('vertex') === '1'
    const isEdge = cell.getAttribute('edge') === '1'
    if (!isVertex && !isEdge) return

    const geometryEl = cell.querySelector('mxGeometry')
    const geometry = geometryEl
      ? {
          x: parseNum(geometryEl.getAttribute('x')),
          y: parseNum(geometryEl.getAttribute('y')),
          width: parseNum(geometryEl.getAttribute('width')),
          height: parseNum(geometryEl.getAttribute('height'))
        }
      : undefined

    cells.set(id, {
      id,
      value: cell.getAttribute('value') || '',
      style: cell.getAttribute('style') || '',
      isVertex,
      isEdge,
      source: cell.getAttribute('source') || undefined,
      target: cell.getAttribute('target') || undefined,
      parent: cell.getAttribute('parent') || '',
      geometry
    })
  })

  const nodes = Array.from(cells.values()).filter((cell) => cell.isVertex)
  const edges = Array.from(cells.values()).filter((cell) => cell.isEdge)

  return { cells, nodes, edges }
}

function mapCellsToSvgElements(svg: string): Map<string, Element> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  const mapping = new Map<string, Element>()

  doc.querySelectorAll('[data-cell-id], [data-node-id]').forEach((el) => {
    const cellId = el.getAttribute('data-cell-id') || el.getAttribute('data-node-id')
    if (cellId) {
      mapping.set(cellId, el)
    }
  })

  return mapping
}

function buildGraphFromModel(model: MxGraphModel): Graph {
  const nodes = model.nodes
    .filter((cell) => !classifyStyle(cell.style).isDecorator)
    .map((cell) => ({
      id: cell.id,
      label: extractLabel(cell.value, classifyStyle(cell.style).shapeType),
      style: cell.style,
      geometry: cell.geometry
    }))

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = model.edges
    .map((cell) => ({
      id: cell.id,
      label: extractLabel(cell.value, 'Line'),
      style: cell.style,
      source: cell.source ?? '',
      target: cell.target ?? ''
    }))
    .filter((edge) => edge.source || edge.target)

  const danglingEdges = edges.filter((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))
  const validEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

  const adjacency = new Map<string, GraphEdge[]>()
  const outgoing = new Map<string, GraphEdge[]>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
    outgoing.set(node.id, [])
  }

  for (const edge of validEdges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency.get(edge.source)!.push(edge)
    adjacency.get(edge.target)!.push(edge)
    outgoing.get(edge.source)!.push(edge)
  }

  return { nodes, edges: validEdges, adjacency, outgoing, danglingEdges }
}

function geometrySortKey(node: { geometry?: { x: number; y: number } } & { label: string }) {
  return [node.geometry?.x ?? 0, node.geometry?.y ?? 0, node.label.toLowerCase()]
}

function nodeLabel(elements: Record<string, ArchElement>, id: string): string {
  const tag = id.split('-')[1] ?? 'shape'
  const num = id.split('-').pop() ?? ''
  return `${tag} ${num}`
}

function interactiveElements(elements: Record<string, ArchElement>): ArchElement[] {
  return Object.values(elements).filter((el) => el.interactive !== false)
}

function renumberSteps(steps: AnimationStep[]): AnimationStep[] {
  return steps.map((step, index) => ({ ...step, id: `step-${index + 1}` }))
}

function appendFlowStep(
  steps: AnimationStep[],
  edge: LegacyGraphEdge,
  elements: Record<string, ArchElement>,
  labelPrefix: string
) {
  steps.push({
    id: `step-${steps.length + 1}`,
    label: `${labelPrefix} ${nodeLabel(elements, edge.to)}`,
    highlight: [edge.to],
    flow: [edge.edgeId],
    nodeAnimation: 'highlight',
    edgeAnimation: 'draw-path',
    durationMs: 1400
  })
}

export function autoGenerateSteps(
  svg: string,
  elements: Record<string, ArchElement>,
  scope: SuggestScope = 'all'
): AnimationStep[] {
  const interactive = interactiveElements(elements)
  const nodeIds = interactive.filter((item) => item.type === 'node').map((item) => item.id)
  const edgeIds = interactive.filter((item) => item.type === 'edge').map((item) => item.id)

  if (
    (scope === 'all' && nodeIds.length === 0 && edgeIds.length === 0) ||
    (scope === 'nodes' && nodeIds.length === 0) ||
    (scope === 'edges' && edgeIds.length === 0)
  ) {
    return []
  }

  const model = parseMxGraph(svg)
  if (model) {
    const graph = buildGraphFromModel(model)
    if (graph.nodes.length > 0) {
      const cellElements = mapCellsToSvgElements(svg)
      const nodeToArchId = new Map<string, string>()
      const edgeToArchId = new Map<string, string>()

      for (const node of graph.nodes) {
        const dom = cellElements.get(node.id)
        const archId = dom?.getAttribute('data-arch-id') || stableArchId('node', node.id)
        nodeToArchId.set(node.id, archId)
      }

      for (const edge of graph.edges) {
        const dom = cellElements.get(edge.id)
        const archId = dom?.getAttribute('data-arch-id') || stableArchId('edge', edge.id)
        edgeToArchId.set(edge.id, archId)
      }

      const nodeLabelMap = new Map(graph.nodes.map((node) => [node.id, node.label]))
      const getNodeLabel = (id: string) => nodeLabelMap.get(id) ?? 'Node'

      const nodeOrder = [...graph.nodes].sort((a, b) => {
        const ax = a.geometry?.x ?? 0
        const ay = a.geometry?.y ?? 0
        const bx = b.geometry?.x ?? 0
        const by = b.geometry?.y ?? 0
        return ax === bx ? ay - by : ax - bx
      })

      if (scope === 'nodes' || graph.edges.length === 0) {
        if (graph.edges.length === 0) {
          return renumberSteps(
            nodeOrder.map((node) => ({
              id: '',
              label: `Highlight ${node.label}`,
              highlight: nodeToArchId.has(node.id) ? [nodeToArchId.get(node.id)!] : [],
              flow: [],
              nodeAnimation: 'highlight',
              edgeAnimation: 'draw-path',
              durationMs: 1200
            }))
          )
        }

        const chunkSize = Math.max(1, Math.ceil(nodeOrder.length / Math.min(nodeOrder.length, 6)))
        const steps: AnimationStep[] = []
        for (let i = 0; i < nodeOrder.length; i += chunkSize) {
          const chunk = nodeOrder.slice(i, i + chunkSize)
          const highlightIds = chunk.map((node) => nodeToArchId.get(node.id)).filter(Boolean) as string[]
          steps.push({
            id: `step-${steps.length + 1}`,
            label: chunk.length === 1 ? `Highlight ${chunk[0].label}` : `Highlight group ${steps.length + 1}`,
            highlight: highlightIds,
            flow: [],
            nodeAnimation: 'highlight',
            edgeAnimation: 'draw-path',
            durationMs: 1200
          })
        }
        if (scope === 'nodes') return steps

        graph.danglingEdges.forEach((edge) => {
          const flowId = edgeToArchId.get(edge.id)
          if (!flowId) return
          steps.push({
            id: `step-${steps.length + 1}`,
            label: `Animate ${edge.label}`,
            highlight: [],
            flow: [flowId],
            nodeAnimation: 'highlight',
            edgeAnimation: 'draw-path',
            durationMs: 1400
          })
        })
        return steps
      }

      if (scope === 'edges') {
        return renumberSteps(
          [
            ...graph.edges.map((edge) => ({
              id: '',
              label: `Animate ${edge.label}`,
              highlight: [],
              flow: edgeToArchId.has(edge.id) ? [edgeToArchId.get(edge.id)!] : [],
              nodeAnimation: 'highlight' as NodeAnimation,
              edgeAnimation: 'draw-path' as EdgeAnimation,
              durationMs: 1400
            })),
            ...graph.danglingEdges
              .map((edge) => ({
                id: '',
                label: `Animate ${edge.label}`,
                highlight: [],
                flow: edgeToArchId.has(edge.id) ? [edgeToArchId.get(edge.id)!] : [],
                nodeAnimation: 'highlight' as NodeAnimation,
                edgeAnimation: 'draw-path' as EdgeAnimation,
                durationMs: 1400
              }))
              .filter((step) => step.flow.length > 0)
          ]
        )
      }

      const incomingCount = new Map<string, number>()
      graph.edges.forEach((edge) => {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
      })

      let startNodes = graph.nodes
        .filter((node) => !incomingCount.has(node.id))
        .map((node) => node.id)

      if (startNodes.length === 0 && graph.nodes.length > 0) {
        startNodes = [...graph.nodes]
          .sort((a, b) => (graph.outgoing.get(b.id)?.length ?? 0) - (graph.outgoing.get(a.id)?.length ?? 0))
          .map((node) => node.id)
          .slice(0, 1)
      }

      const visitedNodes = new Set<string>()
      const usedEdges = new Set<string>()
      const steps: AnimationStep[] = []

      const addHighlightStep = (nodeId: string) => {
        const archId = nodeToArchId.get(nodeId)
        if (!archId) return
        steps.push({
          id: `step-${steps.length + 1}`,
          label: `Highlight ${getNodeLabel(nodeId)}`,
          highlight: [archId],
          flow: [],
          nodeAnimation: 'highlight',
          edgeAnimation: 'draw-path',
          durationMs: 1200
        })
      }

      const appendModelFlowStep = (
        edge: GraphEdge,
        targetId: string | undefined,
        prefix: string
      ) => {
        const flowId = edgeToArchId.get(edge.id)
        steps.push({
          id: `step-${steps.length + 1}`,
          label: `${prefix} ${getNodeLabel(edge.target)}`,
          highlight: targetId ? [targetId] : [],
          flow: flowId ? [flowId] : [],
          nodeAnimation: 'highlight',
          edgeAnimation: 'draw-path',
          durationMs: 1400
        })
      }

      for (const startNode of startNodes) {
        if (!visitedNodes.has(startNode)) {
          addHighlightStep(startNode)
          visitedNodes.add(startNode)
        }

        const queue = [startNode]
        while (queue.length > 0) {
          const current = queue.shift()!
          for (const edge of graph.outgoing.get(current) ?? []) {
            if (usedEdges.has(edge.id)) continue
            usedEdges.add(edge.id)

            const targetArchId = nodeToArchId.get(edge.target)
            appendModelFlowStep(edge, targetArchId, 'Flow to')

            if (!visitedNodes.has(edge.target)) {
              visitedNodes.add(edge.target)
              queue.push(edge.target)
            }
          }
        }
      }

      graph.danglingEdges.forEach((edge) => {
        const flowId = edgeToArchId.get(edge.id)
        if (!flowId) return
        steps.push({
          id: `step-${steps.length + 1}`,
          label: `Animate ${edge.label}`,
          highlight: [],
          flow: [flowId],
          nodeAnimation: 'highlight',
          edgeAnimation: 'draw-path',
          durationMs: 1400
        })
      })

      const unvisitedNodes = graph.nodes.filter((node) => !visitedNodes.has(node.id))
      if (unvisitedNodes.length > 0) {
        steps.push({
          id: `step-${steps.length + 1}`,
          label: 'Remaining nodes',
          highlight: unvisitedNodes
            .map((node) => nodeToArchId.get(node.id))
            .filter(Boolean) as string[],
          flow: [],
          nodeAnimation: 'highlight',
          edgeAnimation: 'draw-path',
          durationMs: 1200
        })
      }

      return steps
    }
  }

  const { edges, adjacency, unmatchedEdgeIds } = buildAdjacencyList(svg, elements)

  if (scope === 'nodes' || edges.length === 0) {
    const chunkSize = Math.max(1, Math.ceil(nodeIds.length / Math.min(nodeIds.length, 6)))
    const steps: AnimationStep[] = []
    for (let i = 0; i < nodeIds.length; i += chunkSize) {
      const chunk = nodeIds.slice(i, i + chunkSize)
      steps.push({
        id: `step-${steps.length + 1}`,
        label:
          chunk.length === 1
            ? `Highlight ${nodeLabel(elements, chunk[0])}`
            : `Highlight group ${steps.length + 1}`,
        highlight: chunk,
        flow: [],
        nodeAnimation: 'highlight',
        edgeAnimation: 'draw-path',
        durationMs: 1200
      })
    }
    if (scope === 'nodes') return steps

    for (const edgeId of unmatchedEdgeIds) {
      steps.push({
        id: `step-${steps.length + 1}`,
        label: `Animate line ${nodeLabel(elements, edgeId).replace('shape', 'line')}`,
        highlight: [],
        flow: [edgeId],
        nodeAnimation: 'highlight',
        edgeAnimation: 'draw-path',
        durationMs: 1400
      })
    }
    return steps
  }

  if (scope === 'edges') {
    return renumberSteps(
      [
        ...edges.map((edge) => ({
          id: '',
          label: `Animate ${nodeLabel(elements, edge.edgeId).replace('shape', 'line')}`,
          highlight: [],
          flow: [edge.edgeId],
          nodeAnimation: 'highlight' as NodeAnimation,
          edgeAnimation: 'draw-path' as EdgeAnimation,
          durationMs: 1400
        })),
        ...unmatchedEdgeIds.map((edgeId) => ({
          id: '',
          label: `Animate ${nodeLabel(elements, edgeId).replace('shape', 'line')}`,
          highlight: [],
          flow: [edgeId],
          nodeAnimation: 'highlight' as NodeAnimation,
          edgeAnimation: 'draw-path' as EdgeAnimation,
          durationMs: 1400
        }))
      ]
    )
  }

  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }

  const visitedNodes = new Set<string>()
  const usedEdges = new Set<string>()
  const steps: AnimationStep[] = []

  const componentStarts = [...degree.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  for (const startNode of componentStarts) {
    if (visitedNodes.has(startNode)) continue

    if (steps.length === 0 || !steps.some((s) => s.highlight.includes(startNode))) {
      steps.push({
        id: `step-${steps.length + 1}`,
        label: `Start at ${nodeLabel(elements, startNode)}`,
        highlight: [startNode],
        flow: [],
        nodeAnimation: 'highlight',
        edgeAnimation: 'draw-path',
        durationMs: 1200
      })
    }
    visitedNodes.add(startNode)

    const queue = [startNode]
    while (queue.length > 0) {
      const current = queue.shift()!
      const incident = adjacency.get(current) ?? []

      for (const edge of incident) {
        if (usedEdges.has(edge.edgeId)) continue
        usedEdges.add(edge.edgeId)

        appendFlowStep(steps, edge, elements, 'Flow to')

        if (!visitedNodes.has(edge.to)) {
          visitedNodes.add(edge.to)
          queue.push(edge.to)
        }
      }
    }
  }

  for (const edge of edges) {
    if (usedEdges.has(edge.edgeId)) continue
    usedEdges.add(edge.edgeId)
    appendFlowStep(steps, edge, elements, 'Connect to')
    visitedNodes.add(edge.from)
    visitedNodes.add(edge.to)
  }

  for (const edgeId of unmatchedEdgeIds) {
    steps.push({
      id: `step-${steps.length + 1}`,
      label: `Animate ${nodeLabel(elements, edgeId)}`,
      highlight: [],
      flow: [edgeId],
      nodeAnimation: 'highlight',
      edgeAnimation: 'draw-path',
      durationMs: 1400
    })
  }

  const unvisitedNodes = nodeIds.filter((id) => !visitedNodes.has(id))
  if (unvisitedNodes.length > 0) {
    steps.push({
      id: `step-${steps.length + 1}`,
      label: 'Remaining nodes',
      highlight: unvisitedNodes,
      flow: [],
      nodeAnimation: 'highlight',
      edgeAnimation: 'draw-path',
      durationMs: 1200
    })
  }

  return steps
}

export function buildPlaybackVisualState(
  steps: AnimationStep[],
  currentIndex: number
): {
  seenHighlight: string[]
  seenFlow: string[]
  currentHighlight: string[]
  currentFlow: string[]
  nodeAnimationType?: string
  edgeAnimationType?: string
  label?: string
} {
  const seenHighlight = new Set<string>()
  const seenFlow = new Set<string>()

  for (let i = 0; i < currentIndex; i++) {
    steps[i]?.highlight.forEach((id) => seenHighlight.add(id))
    steps[i]?.flow.forEach((id) => seenFlow.add(id))
  }

  const current = steps[currentIndex]
  return {
    seenHighlight: [...seenHighlight],
    seenFlow: [...seenFlow],
    currentHighlight: current?.highlight ?? [],
    currentFlow: current?.flow ?? [],
    nodeAnimationType: current?.nodeAnimation,
    edgeAnimationType: current?.edgeAnimation,
    label: current?.label
  }
}
