export type ElementType = 'node' | 'edge'
export type SuggestScope = 'all' | 'nodes' | 'edges'

export interface ArchElement {
  id: string
  type: ElementType
  domSelector: string
  interactive?: boolean
}

export interface MxCell {
  id: string
  value: string
  style: string
  isVertex: boolean
  isEdge: boolean
  source?: string
  target?: string
  parent: string
  geometry?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface MxGraphModel {
  cells: Map<string, MxCell>
  nodes: MxCell[]
  edges: MxCell[]
}

export interface GraphNode {
  id: string
  label: string
  style: string
  geometry?: { x: number; y: number; width: number; height: number }
}

export interface GraphEdge {
  id: string
  label: string
  style: string
  source: string
  target: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  adjacency: Map<string, GraphEdge[]>
  outgoing: Map<string, GraphEdge[]>
  danglingEdges: GraphEdge[]
}

export type NodeAnimation = 
  | 'highlight' 
  | 'fade-in' 
  | 'scale-up' 
  | 'color-change'
  | 'bounce'
  | 'pulse-grow'
  | 'rotate'
  | 'blink'

export type EdgeAnimation = 
  | 'draw-path' 
  | 'flow' 
  | 'fade-in' 
  | 'pulse'
  | 'dash-flow'
  | 'glow-pulse'
  | 'wave'
  | 'shimmer'

export interface AnimationStep {
  id: string
  label: string
  highlight: string[]
  flow: string[]
  nodeAnimation: NodeAnimation
  edgeAnimation: EdgeAnimation
  durationMs: number
}

export interface ProjectState {
  version: '1.0'
  svg: string
  elements: Record<string, ArchElement>
  steps: AnimationStep[]
}

export interface PlaybackState {
  isPlaying: boolean
  currentStep: number
  speed: 'slow' | 'normal' | 'fast'
  loop: boolean
}
