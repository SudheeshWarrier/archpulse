import { AnimationStep, ArchElement } from '../types'
import { buildAdjacencyList, GraphEdge } from './graphUtils'

function nodeLabel(elements: Record<string, ArchElement>, id: string): string {
  const tag = id.split('-')[1] ?? 'shape'
  const num = id.split('-').pop() ?? ''
  return `${tag} ${num}`
}

function interactiveElements(elements: Record<string, ArchElement>): ArchElement[] {
  return Object.values(elements).filter((el) => el.interactive !== false)
}

function appendFlowStep(
  steps: AnimationStep[],
  edge: GraphEdge,
  elements: Record<string, ArchElement>,
  labelPrefix: string
) {
  steps.push({
    id: `step-${steps.length + 1}`,
    label: `${labelPrefix} ${nodeLabel(elements, edge.to)}`,
    highlight: [edge.to],
    flow: [edge.edgeId],
    durationMs: 1400
  })
}

export function autoGenerateSteps(
  svg: string,
  elements: Record<string, ArchElement>
): AnimationStep[] {
  const interactive = interactiveElements(elements)
  const nodeIds = interactive.filter((item) => item.type === 'node').map((item) => item.id)
  const edgeIds = interactive.filter((item) => item.type === 'edge').map((item) => item.id)

  if (nodeIds.length === 0 && edgeIds.length === 0) return []

  const { edges, adjacency, unmatchedEdgeIds } = buildAdjacencyList(svg, elements)

  if (edges.length === 0) {
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
        durationMs: 1200
      })
    }
    for (const edgeId of unmatchedEdgeIds) {
      steps.push({
        id: `step-${steps.length + 1}`,
        label: `Animate line ${nodeLabel(elements, edgeId).replace('shape', 'line')}`,
        highlight: [],
        flow: [edgeId],
        durationMs: 1400
      })
    }
    return steps
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
    label: current?.label
  }
}
