export type ElementType = 'node' | 'edge'

export interface ArchElement {
  id: string
  type: ElementType
  domSelector: string
  interactive?: boolean
}

export interface AnimationStep {
  id: string
  label: string
  highlight: string[]
  flow: string[]
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
