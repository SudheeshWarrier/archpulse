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
import { AnimationStep, EdgeAnimation, NodeAnimation, SuggestScope } from './types'
import logo from './assets/archpulse.png'
import './animations.css'
import './styles.css'

type ThemePreference = 'system' | 'light' | 'dark'

const NODE_ANIMATION_OPTIONS: { value: NodeAnimation; label: string }[] = [
  { value: 'highlight', label: 'Highlight (Glow)' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'scale-up', label: 'Scale Up' },
  { value: 'color-change', label: 'Color Change' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'pulse-grow', label: 'Pulse Grow' },
  { value: 'rotate', label: 'Rotate' },
  { value: 'blink', label: 'Blink' }
]

const EDGE_ANIMATION_OPTIONS: { value: EdgeAnimation; label: string }[] = [
  { value: 'draw-path', label: 'Draw Path' },
  { value: 'flow', label: 'Flow Along Path' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'dash-flow', label: 'Dash Flow' },
  { value: 'glow-pulse', label: 'Glow Pulse' },
  { value: 'wave', label: 'Wave' },
  { value: 'shimmer', label: 'Shimmer' }
]

export default function App() {
  const [state, dispatch] = useProjectReducer()
  const [editingIndex, setEditingIndex] = useState(0)
  const [suggestedSteps, setSuggestedSteps] = useState<ReturnType<typeof autoGenerateSteps> | null>(
    null
  )
  const [suggestedNodeAnimation, setSuggestedNodeAnimation] = useState<NodeAnimation>('highlight')
  const [suggestedEdgeAnimation, setSuggestedEdgeAnimation] = useState<EdgeAnimation>('draw-path')
  const [isSuggestScopeOpen, setIsSuggestScopeOpen] = useState(false)
  const [isCanvasMaximized, setIsCanvasMaximized] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>('system')
  const playback = usePlayback({ stepsCount: state.steps.length })
  const canvasRef = React.useRef<HTMLDivElement | null>(null)

  const hasSvg = Boolean(state.svg)
  const isPlaying = playback.isPlaying

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('archpulse-theme') as ThemePreference | null
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      setThemePreference(storedTheme)
    }
  }, [])

  useEffect(() => {
    const updateTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const effectiveTheme = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference
      document.documentElement.classList.toggle('theme-dark', effectiveTheme === 'dark')
      document.documentElement.classList.toggle('theme-light', effectiveTheme === 'light')
    }

    updateTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (themePreference === 'system') {
        updateTheme()
      }
    }
    mediaQuery.addEventListener?.('change', listener)
    return () => mediaQuery.removeEventListener?.('change', listener)
  }, [themePreference])

  useEffect(() => {
    window.localStorage.setItem('archpulse-theme', themePreference)
  }, [themePreference])

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
      window.setTimeout(() => {
        canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
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
            flow: state.elements[elementId]?.type === 'edge' ? [elementId] : [],
            nodeAnimation: state.elements[elementId]?.type === 'node' ? 'highlight' : 'highlight',
            edgeAnimation: state.elements[elementId]?.type === 'edge' ? 'draw-path' : 'draw-path'
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

  const generateSuggestion = useCallback((scope: SuggestScope) => {
    if (!state.svg) return
    const steps = autoGenerateSteps(state.svg, state.elements, scope).map((step) => ({
      ...step,
      nodeAnimation: suggestedNodeAnimation,
      edgeAnimation: suggestedEdgeAnimation
    }))
    if (steps.length === 0) {
      alert('Could not detect animatable elements in this diagram.')
      return
    }
    setSuggestedSteps(steps)
  }, [state.elements, state.svg, suggestedEdgeAnimation, suggestedNodeAnimation])

  const handleSuggest = useCallback(() => {
    if (!state.svg) return
    setIsSuggestScopeOpen(true)
  }, [state.svg])

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

  const acceptSuggestion = useCallback((steps: AnimationStep[]) => {
    // Ensure every step has a unique, sequential id before storing
    const renumberedSteps = steps.map((step, index) => ({
      ...step,
      id: `step-${index + 1}`
    }))
    // Replace the whole steps array in state
    dispatch({ type: 'SET_STEPS', payload: renumberedSteps })
    // Reset UI state so the editor points at the first step
    setEditingIndex(0)
    playback.setCurrentStep(0)
    // Close the suggestion modal
    setSuggestedSteps(null)
    // Reset the animation selectors for the next suggestion round
    setSuggestedNodeAnimation('highlight')
    setSuggestedEdgeAnimation('draw-path')
  }, [dispatch, playback, setSuggestedNodeAnimation, setSuggestedEdgeAnimation])

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
        <a className="app-brand" href="#" aria-label="ArchPulse home">
          <img className="app-brand-logo" src={logo} alt="" />
          <span>ArchPulse</span>
          <span className="beta-tag">BETA</span>
        </a>

        <div className="header-actions" aria-label="Theme and pricing">
          <div className="theme-segmented" role="group" aria-label="Theme">
            {[
              { value: 'system', icon: 'desktop_windows', label: 'System' },
              { value: 'light', icon: 'light_mode', label: 'Light' },
              { value: 'dark', icon: 'dark_mode', label: 'Dark' }
            ].map((theme) => (
              <button
                key={theme.value}
                type="button"
                className={themePreference === theme.value ? 'is-active' : ''}
                onClick={() => setThemePreference(theme.value as ThemePreference)}
                aria-pressed={themePreference === theme.value}
                aria-label={`${theme.label} theme`}
                title={`${theme.label} theme`}
              >
                <span className="material-icons" aria-hidden="true">{theme.icon}</span>
                <span className="theme-label">{theme.label}</span>
              </button>
            ))}
          </div>
          <a href="#pricing" className="header-pricing-link" aria-label="View pricing">
            <span className="material-icons" aria-hidden="true">sell</span>
            Pricing
          </a>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <p className="eyebrow">Architecture walkthrough builder</p>
          <h1>Turn static diagrams into clear animated walkthroughs.</h1>
          <p className="hero-copy">
            Import an SVG, choose what appears at each moment, and play the system flow back as a
            focused story your team can review together.
          </p>

          <ul className="hero-feature-list" aria-label="Key features">
            <li>
              <span className="material-icons" aria-hidden="true">upload_file</span>
              SVG imports from diagram tools
            </li>
            <li>
              <span className="material-icons" aria-hidden="true">auto_awesome</span>
              Suggested animation steps
            </li>
            <li>
              <span className="material-icons" aria-hidden="true">play_circle</span>
              Review-ready playback
            </li>
          </ul>
        </div>

        <div className="hero-upload-section">
          <div className="hero-upload-card">
            <div className="hero-upload-meta">
              <p className="hero-upload-title">Upload your SVG</p>
              <p className="hero-upload-description">
                Drop a file here or choose from your device to begin animating.
              </p>
            </div>
            <UploadZone onLoad={handleUpload} />
          </div>
        </div>
      </section>

      <main className={`editor-workspace${isCanvasMaximized ? ' is-canvas-maximized' : ''}`}>
        <section ref={canvasRef} className={`canvas-stage${isCanvasMaximized ? ' is-maximized' : ''}`}>
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
            <SaveLoad state={state} dispatch={dispatch} />
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
          onUpdateNodeAnimation={(stepId, nodeAnimation) =>
            dispatch({ type: 'UPDATE_STEP', payload: { stepId, nodeAnimation } })
          }
          onUpdateEdgeAnimation={(stepId, edgeAnimation) =>
            dispatch({ type: 'UPDATE_STEP', payload: { stepId, edgeAnimation } })
          }
          onUnassign={(stepId, elementId) =>
            dispatch({ type: 'UNASSIGN_ELEMENT', payload: { stepId, elementId } })
          }
          onSuggest={handleSuggest}
          hasSvg={hasSvg}
        />
      </main>

      <section id="pricing" className="pricing-section">
        <div className="pricing-grid">
          <article className="pricing-card">
            <h3>Basic — FREE</h3>
            <p className="pricing-sub">For those who like to keep it simple</p>
            <ul>
              <li>Turn diagrams into usable data</li>
              <li>Identify shapes and how they connect</li>
              <li>Works well with most common diagram styles</li>
              <li>Export results to plug into your workflow</li>
              <li>(Yes… this is basically the same as Premium)</li>
            </ul>
            <p className="pricing-price">💸 Price: FREE (no surprises here)</p>
          </article>

          <article className="pricing-card">
            <h3>Premium — FREE</h3>
            <p className="pricing-sub">For those who enjoy a more “refined” experience</p>
            <ul>
              <li>Convert diagrams into structured output</li>
              <li>Understand elements and their relationships</li>
              <li>Handles typical diagrams without complaining</li>
              <li>Output ready for whatever you’re building next</li>
              <li>(It’s the same thing as Basic, we just dressed it up)</li>
            </ul>
            <p className="pricing-price">🔥 Price: FREE (premium, obviously)</p>
          </article>
        </div>
      </section>

      {isSuggestScopeOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="suggest-scope-title">
          <div className="modal-card suggest-modal">
            <header className="modal-header">
              <h3 id="suggest-scope-title">Suggest animation sequence</h3>
              <p>Choose animation styles and which elements to animate</p>
            </header>

            <div className="suggest-content">
              <section className="suggest-section">
                <h4 className="suggest-section-title">Animation Styles</h4>
                <div className="suggest-animation-row">
                  <label className="animation-field">
                    <span className="field-name">For Shapes</span>
                    <select
                      value={suggestedNodeAnimation}
                      onChange={(event) => setSuggestedNodeAnimation(event.target.value as NodeAnimation)}
                      className="animation-select"
                    >
                      {NODE_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="animation-field">
                    <span className="field-name">For Lines</span>
                    <select
                      value={suggestedEdgeAnimation}
                      onChange={(event) => setSuggestedEdgeAnimation(event.target.value as EdgeAnimation)}
                      className="animation-select"
                    >
                      {EDGE_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="suggest-section">
                <h4 className="suggest-section-title">Diagram Scope</h4>
                <div className="suggest-scope-grid">
                  {[
                    { value: 'all', icon: 'account_tree', title: 'All', meta: 'Nodes and lines' },
                    { value: 'nodes', icon: 'category', title: 'Shapes only', meta: 'Highlight steps' },
                    { value: 'edges', icon: 'timeline', title: 'Lines only', meta: 'Flow steps' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="suggest-scope-option"
                      onClick={() => {
                        setIsSuggestScopeOpen(false)
                        generateSuggestion(option.value as SuggestScope)
                      }}
                    >
                      <span className="material-icons" aria-hidden="true">{option.icon}</span>
                      <strong>{option.title}</strong>
                      <span>{option.meta}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <footer className="modal-footer">
              <button type="button" className="ghost" onClick={() => setIsSuggestScopeOpen(false)}>
                Cancel
              </button>
            </footer>
          </div>
        </div>
      )}

      {suggestedSteps && (
        <AutoSuggestModal
          steps={suggestedSteps}
          onAccept={acceptSuggestion}
          onReject={() => setSuggestedSteps(null)}
        />
      )}

      <footer className="app-footer">
        <div className="app-footer-inner">
          <p className="footer-tag">Making architecture diagrams beautiful, one line at a time.</p>
          <p className="footer-copy">© {new Date().getFullYear()} ArchPulse — All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
