import React, { useEffect, useRef } from 'react'
import { injectEdgeHitAreas, pickArchElementId } from '../utils/edgeHitTest'

export type CanvasMode = 'edit' | 'playback'

export type PlaybackVisualState = {
  seenHighlight: string[]
  seenFlow: string[]
  currentHighlight: string[]
  currentFlow: string[]
  label?: string
}

type Props = {
  svg: string
  mode: CanvasMode
  onElementClick?: (id: string) => void
  activeStep?: { highlight: string[]; flow: string[] } | null
  playbackState?: PlaybackVisualState | null
}

function setupFlowPath(el: Element, completed = false) {
  if (!(el instanceof SVGGeometryElement)) return
  try {
    const length = el.getTotalLength()
    if (!Number.isFinite(length) || length <= 0) return
    el.style.strokeDasharray = `${length}`
    el.style.strokeDashoffset = completed ? '0' : `${length}`
  } catch {
    /* ignore */
  }
}

export default function SVGCanvas({ svg, mode, onElementClick, activeStep, playbackState }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !svg) return () => undefined
    return injectEdgeHitAreas(el)
  }, [svg])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !svg) return

    el.querySelectorAll('[data-arch-id]').forEach((node) => {
      if (node.hasAttribute('data-arch-hit')) return
      node.classList.remove(
        'arch-editing-node',
        'arch-editing-edge',
        'arch-highlighted',
        'arch-flowing',
        'arch-seen-node',
        'arch-seen-edge',
        'arch-dimmed'
      )
      if (node instanceof SVGGeometryElement) {
        node.style.strokeDasharray = ''
        node.style.strokeDashoffset = ''
      }
    })

    if (mode === 'edit' && activeStep) {
      activeStep.highlight.forEach((id) => {
        const node = el.querySelector(`[data-arch-id="${id}"]:not([data-arch-hit])`)
        if (node) node.classList.add('arch-editing-node')
      })
      activeStep.flow.forEach((id) => {
        const node = el.querySelector(`[data-arch-id="${id}"]:not([data-arch-hit])`)
        if (node) {
          node.classList.add('arch-editing-edge')
          setupFlowPath(node)
        }
      })

      el.querySelectorAll('[data-arch-id]:not([data-arch-hit])').forEach((node) => {
        const id = node.getAttribute('data-arch-id')
        if (!id) return
        const assigned = activeStep.highlight.includes(id) || activeStep.flow.includes(id)
        if (!assigned) node.classList.add('arch-dimmed')
      })
    }

    if (mode === 'playback' && playbackState) {
      const { seenHighlight, seenFlow, currentHighlight, currentFlow } = playbackState
      const currentHighlightSet = new Set(currentHighlight)
      const currentFlowSet = new Set(currentFlow)

      seenHighlight.forEach((id) => {
        if (currentHighlightSet.has(id)) return
        const node = el.querySelector(`[data-arch-id="${id}"]:not([data-arch-hit])`)
        if (node) node.classList.add('arch-seen-node')
      })

      seenFlow.forEach((id) => {
        if (currentFlowSet.has(id)) return
        const node = el.querySelector(`[data-arch-id="${id}"]:not([data-arch-hit])`)
        if (node) {
          setupFlowPath(node, true)
          node.classList.add('arch-seen-edge')
        }
      })

      currentHighlight.forEach((id) => {
        const node = el.querySelector(`[data-arch-id="${id}"]:not([data-arch-hit])`)
        if (node) node.classList.add('arch-highlighted')
      })

      currentFlow.forEach((id) => {
        const node = el.querySelector(`[data-arch-id="${id}"]:not([data-arch-hit])`)
        if (node) {
          setupFlowPath(node, false)
          node.classList.add('arch-flowing')
        }
      })
    }
  }, [svg, mode, activeStep, playbackState])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onClick(e: MouseEvent) {
      if (mode !== 'edit' || !onElementClick) return
      const id = pickArchElementId(el!, e.clientX, e.clientY)
      if (id) onElementClick(id)
    }

    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [mode, onElementClick])

  return (
    <div className="svg-canvas-wrap" ref={containerRef} aria-label="svg-canvas">
      {svg ? (
        <div className="svg-canvas-inner" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="svg-canvas-empty">
          <div className="svg-canvas-empty-icon">
            <span className="material-icons" aria-hidden="true">account_tree</span>
          </div>
          <p>Upload an SVG to begin</p>
          <span>Click shapes and lines to build animations step by step</span>
        </div>
      )}

      {mode === 'playback' && playbackState?.label && (
        <div className="playback-caption" role="status">
          {playbackState.label}
        </div>
      )}
    </div>
  )
}
