import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useProjectReducer } from './hooks/useProjectReducer'
import UploadZone from './components/UploadZone'
import SVGCanvas from './components/SVGCanvas'
import AnimationPane from './components/AnimationPane'
import AutoSuggestModal from './components/AutoSuggestModal'
import Toolbar from './components/Toolbar'
import SaveLoad from './components/SaveLoad'
import { usePlayback } from './hooks/usePlayback'
import { parseSVG } from './utils/parseSVG'
import { autoGenerateSteps, buildPlaybackVisualState } from './utils/autoGenerate'
import './animations.css'
import './styles.css'

export default function App() {
  const [state, dispatch] = useProjectReducer()
  const [editingIndex, setEditingIndex] = useState(0)
  const [suggestedSteps, setSuggestedSteps] = useState<ReturnType<typeof autoGenerateSteps> | null>(
    null
  )
  const [isCanvasMaximized, setIsCanvasMaximized] = useState(false)
  const playback = usePlayback({ stepsCount: state.steps.length })

  const hasSvg = Boolean(state.svg)
  const isPlaying = playback.isPlaying

  useEffect(() => {
    if (state.steps.length === 0) {
      setEditingIndex(0)
      return
    }
    if (editingIndex >= state.steps.length) {
      setEditingIndex(state.steps.length - 1)
    }
  }, [editingIndex, state.steps.length])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.code === 'Space') {
        e.preventDefault()
        if (state.steps.length > 0) playback.togglePlay()
      } else if (e.code === 'ArrowRight') {
        playback.next()
      } else if (e.code === 'ArrowLeft') {
        playback.prev()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playback.togglePlay, playback.next, playback.prev, state.steps.length])

  const handleUpload = useCallback(
    (rawSvg: string) => {
      const parsed = parseSVG(rawSvg)
      dispatch({
        type: 'SET_PROJECT',
        payload: {
          version: '1.0',
          svg: parsed.svg,
          elements: parsed.elements,
          steps: []
        }
      })
      setEditingIndex(0)
      playback.setCurrentStep(0)
    },
    [dispatch, playback.setCurrentStep]
  )

  const handleElementClick = useCallback(
    (elementId: string) => {
      if (isPlaying) return

      if (state.steps.length === 0) {
        dispatch({
          type: 'ADD_STEP',
          payload: {
            label: 'First animation',
            highlight: state.elements[elementId]?.type === 'node' ? [elementId] : [],
            flow: state.elements[elementId]?.type === 'edge' ? [elementId] : []
          }
        })
        setEditingIndex(0)
        return
      }

      const activeStep = state.steps[editingIndex]
      if (!activeStep) return
      dispatch({ type: 'ASSIGN_ELEMENT', payload: { stepId: activeStep.id, elementId } })
    },
    [dispatch, editingIndex, isPlaying, state.elements, state.steps]
  )

  const handleSuggest = useCallback(() => {
    if (!state.svg) return
    const steps = autoGenerateSteps(state.svg, state.elements)
    if (steps.length === 0) {
      alert('Could not detect animatable elements in this diagram.')
      return
    }
    setSuggestedSteps(steps)
  }, [state.elements, state.svg])

  const handleMoveStep = useCallback(
    (stepId: string, direction: -1 | 1) => {
      const currentOrder = [...state.steps]
      const sourceIndex = currentOrder.findIndex((step) => step.id === stepId)
      if (sourceIndex < 0) return
      const targetIndex = sourceIndex + direction
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return

      const [moved] = currentOrder.splice(sourceIndex, 1)
      currentOrder.splice(targetIndex, 0, moved)
      dispatch({ type: 'REORDER_STEPS', payload: currentOrder.map((step) => step.id) })

      const currentEditingStep = state.steps[editingIndex]
      if (currentEditingStep) {
        const newIndex = currentOrder.findIndex((step) => step.id === currentEditingStep.id)
        if (newIndex >= 0) setEditingIndex(newIndex)
      }
    },
    [dispatch, editingIndex, state.steps]
  )

  const acceptSuggestion = useCallback(() => {
    if (!suggestedSteps) return
    dispatch({ type: 'SET_STEPS', payload: suggestedSteps })
    setEditingIndex(0)
    playback.setCurrentStep(0)
    setSuggestedSteps(null)
  }, [dispatch, playback, suggestedSteps])

  const editingStep = state.steps[editingIndex] ?? null
  const playbackVisual = useMemo(
    () =>
      isPlaying && state.steps.length > 0
        ? buildPlaybackVisualState(state.steps, playback.currentStep)
        : null,
    [isPlaying, state.steps, playback.currentStep]
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <p className="eyebrow">ArchPulse</p>
          <h1>Diagram storytelling</h1>
          <p className="hero-copy">
            Build step-by-step animations on your architecture diagram — select a step, click nodes
            to highlight and lines to animate flow.
          </p>
        </div>
        <div className="header-actions">
          <UploadZone onLoad={handleUpload} />
          <SaveLoad state={state} dispatch={dispatch} />
        </div>
      </header>

      <main className={`editor-workspace${isCanvasMaximized ? ' is-canvas-maximized' : ''}`}>
        <section className={`canvas-stage${isCanvasMaximized ? ' is-maximized' : ''}`}>
          <div className="stage-toolbar">
            <Toolbar
              isPlaying={playback.isPlaying}
              onPlayPause={playback.togglePlay}
              onPrev={playback.prev}
              onNext={playback.next}
              speed={playback.speed}
              setSpeed={playback.setSpeed}
              loop={playback.loop}
              setLoop={playback.setLoop}
              onToggleMaximize={() => setIsCanvasMaximized((value) => !value)}
              isMaximized={isCanvasMaximized}
              stepCount={state.steps.length}
              currentStep={playback.currentStep}
              disabled={!hasSvg || state.steps.length === 0}
            />
          </div>

          <SVGCanvas
            svg={state.svg}
            mode={isPlaying ? 'playback' : 'edit'}
            onElementClick={handleElementClick}
            activeStep={
              !isPlaying && editingStep
                ? { highlight: editingStep.highlight, flow: editingStep.flow }
                : null
            }
            playbackState={playbackVisual}
          />

          {!isPlaying && hasSvg && state.steps.length > 0 && (
            <p className="canvas-hint">
              Editing step {editingIndex + 1} of {state.steps.length} — click shapes to highlight,
              lines to animate flow
            </p>
          )}
          {isPlaying && (
            <p className="canvas-hint">
              Playing step {playback.currentStep + 1} of {state.steps.length} — diagram stays fully
              visible; each step builds on the last
            </p>
          )}
        </section>

        <AnimationPane
          steps={state.steps}
          elements={state.elements}
          editingIndex={editingIndex}
          playingIndex={isPlaying ? playback.currentStep : null}
          onEditingIndexChange={setEditingIndex}
          onAdd={() => {
            dispatch({ type: 'ADD_STEP' })
            setEditingIndex(state.steps.length)
          }}
          onRemove={(id) => dispatch({ type: 'REMOVE_STEP', payload: id })}
          onMoveStep={handleMoveStep}
          onUpdateLabel={(stepId, label) =>
            dispatch({ type: 'UPDATE_STEP', payload: { stepId, label } })
          }
          onUnassign={(stepId, elementId) =>
            dispatch({ type: 'UNASSIGN_ELEMENT', payload: { stepId, elementId } })
          }
          onSuggest={handleSuggest}
          hasSvg={hasSvg}
        />
      </main>

      {suggestedSteps && (
        <AutoSuggestModal
          steps={suggestedSteps}
          onAccept={acceptSuggestion}
          onReject={() => setSuggestedSteps(null)}
        />
      )}
    </div>
  )
}
