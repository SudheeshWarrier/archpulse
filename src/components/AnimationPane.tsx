import React, { useMemo, useState } from 'react'
import { AnimationStep, ArchElement, EdgeAnimation, NodeAnimation } from '../types'

type Props = {
  steps: AnimationStep[]
  elements: Record<string, ArchElement>
  editingIndex: number
  playingIndex: number | null
  onEditingIndexChange: (index: number) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onMoveStep: (stepId: string, direction: -1 | 1) => void
  onUpdateLabel: (stepId: string, label: string) => void
  onUpdateNodeAnimation: (stepId: string, value: NodeAnimation) => void
  onUpdateEdgeAnimation: (stepId: string, value: EdgeAnimation) => void
  onUnassign: (stepId: string, elementId: string) => void
  onSuggest: () => void
  hasSvg: boolean
}

function elementName(elements: Record<string, ArchElement>, id: string): string {
  const el = elements[id]
  if (!el) return id
  const short = id.replace(/^arch-/, '')
  return el.type === 'node' ? `Node · ${short}` : `Line · ${short}`
}

export default function AnimationPane({
  steps,
  elements,
  editingIndex,
  playingIndex,
  onEditingIndexChange,
  onAdd,
  onRemove,
  onMoveStep,
  onUpdateLabel,
  onUnassign,
  onSuggest,
  hasSvg
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const activeStep = steps[editingIndex] ?? null

  const filteredSteps = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) return steps
    return steps.filter((step, index) => {
      return (
        step.label.toLowerCase().includes(normalized) ||
        `${index + 1}`.includes(normalized)
      )
    })
  }, [searchTerm, steps])

  return (
    <aside className="animation-pane">
      <header className="animation-pane-header">
        <div>
          <h2>Animations</h2>
          <p>{steps.length > 0 ? `${steps.length} steps` : 'Select a step, then click the canvas.'}</p>
        </div>
        <div className="animation-pane-actions">
          <button type="button" className="ghost compact" onClick={onAdd} disabled={!hasSvg}>
            <span className="material-icons" aria-hidden="true">add</span>
            Add stop
          </button>
          <button type="button" className="secondary compact" onClick={onSuggest} disabled={!hasSvg}>
            <span className="material-icons" aria-hidden="true">auto_awesome</span>
            Suggest
          </button>
        </div>
      </header>

      {!hasSvg && (
        <div className="animation-pane-empty">Upload a diagram first, then add animation steps here.</div>
      )}

      {hasSvg && steps.length === 0 && (
        <div className="animation-pane-empty">
          <p>No animations yet.</p>
          <button type="button" onClick={onAdd}>
            Add first animation
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <div className="animation-pane-body">
          <div className="step-search">
            <label className="sr-only" htmlFor="step-search-input">
              Search animation steps
            </label>
            <input
              id="step-search-input"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search steps"
            />
          </div>
          {filteredSteps.length === 0 ? (
            <div className="step-search-empty">No steps match your search.</div>
          ) : (
            <ol className="step-timeline" aria-label="Animation steps">
              {filteredSteps.map((step) => {
                const stepIndex = steps.findIndex((source) => source.id === step.id)
                const isEditing = stepIndex === editingIndex
                const isPlaying = playingIndex === stepIndex
                const nodeCount = step.highlight.length
                const edgeCount = step.flow.length

                return (
                  <li key={step.id}>
                    <div
                      className={`step-timeline-row ${isEditing ? 'is-editing' : ''} ${isPlaying ? 'is-playing' : ''}`}
                      onClick={() => onEditingIndexChange(stepIndex)}
                      role="button"
                      tabIndex={0}
                      aria-current={isEditing ? 'step' : undefined}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onEditingIndexChange(stepIndex)
                        }
                      }}
                    >
                      <span className="step-timeline-num">{stepIndex + 1}</span>
                      <span className="step-timeline-body">
                        <span className="step-timeline-label">
                          {step.label || `Animation ${stepIndex + 1}`}
                        </span>
                        <span className="step-timeline-meta">
                          {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {edgeCount} line
                          {edgeCount !== 1 ? 's' : ''}
                          {nodeCount > 0 ? ` · ${step.nodeAnimation}` : ''}
                          {edgeCount > 0 ? ` · ${step.edgeAnimation}` : ''}
                        </span>
                      </span>
                      <div className="step-row-actions">
                        <button
                          type="button"
                          className="ghost icon-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveStep(step.id, -1)
                          }}
                          disabled={stepIndex === 0}
                          aria-label="Move step up"
                          title="Move step up"
                        >
                          <span className="material-icons" aria-hidden="true">arrow_upward</span>
                        </button>
                        <button
                          type="button"
                          className="ghost icon-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveStep(step.id, 1)
                          }}
                          disabled={stepIndex === steps.length - 1}
                          aria-label="Move step down"
                          title="Move step down"
                        >
                          <span className="material-icons" aria-hidden="true">arrow_downward</span>
                        </button>
                        <button
                          type="button"
                          className="ghost icon-btn danger-text"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemove(step.id)
                          }}
                          aria-label="Delete step"
                          title="Delete step"
                        >
                          <span className="material-icons" aria-hidden="true">delete</span>
                        </button>
                      </div>
                      {isPlaying && (
                        <span className="step-playing-badge" aria-label="Playing">
                          <span className="material-icons" aria-hidden="true">play_arrow</span>
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {activeStep && (
            <div className="step-detail">
              <div className="step-detail-header">
                <span className="step-detail-num">Step {editingIndex + 1} details</span>
                <button
                  type="button"
                  className="ghost danger-text step-detail-delete"
                  onClick={() => onRemove(activeStep.id)}
                >
                  <span className="material-icons" aria-hidden="true">delete</span>
                  Delete
                </button>
              </div>

              <label className="field-label">
                Label
                <input
                  type="text"
                  value={activeStep.label}
                  onChange={(e) => onUpdateLabel(activeStep.id, e.target.value)}
                  placeholder="Describe this animation step"
                />
              </label>

              <div className="step-animation-fields">
                <label className="field-label">
                  <span className="field-label-text">Shape animation</span>
                  <select
                    value={activeStep.nodeAnimation}
                    onChange={(e) => onUpdateNodeAnimation(activeStep.id, e.target.value as NodeAnimation)}
                    title={`${activeStep.highlight.length} shape(s) selected`}
                  >
                    <option value="highlight">Highlight (Glow)</option>
                    <option value="fade-in">Fade In</option>
                    <option value="scale-up">Scale Up</option>
                    <option value="color-change">Color Change</option>
                    <option value="bounce">Bounce</option>
                    <option value="pulse-grow">Pulse Grow</option>
                    <option value="rotate">Rotate</option>
                    <option value="blink">Blink</option>
                  </select>
                  {activeStep.highlight.length === 0 && (
                    <span className="field-hint">Click shapes on canvas to assign</span>
                  )}
                </label>

                <label className="field-label">
                  <span className="field-label-text">Line animation</span>
                  <select
                    value={activeStep.edgeAnimation}
                    onChange={(e) => onUpdateEdgeAnimation(activeStep.id, e.target.value as EdgeAnimation)}
                    disabled={activeStep.flow.length === 0}
                    title={`${activeStep.flow.length} line(s) selected`}
                  >
                    <option value="draw-path">Draw Path</option>
                    <option value="flow">Flow Along Path</option>
                    <option value="fade-in">Fade In</option>
                    <option value="pulse">Pulse</option>
                    <option value="dash-flow">Dash Flow</option>
                    <option value="glow-pulse">Glow Pulse</option>
                    <option value="wave">Wave</option>
                    <option value="shimmer">Shimmer</option>
                  </select>
                  {activeStep.flow.length === 0 && (
                    <span className="field-hint">Click connector lines on canvas to assign</span>
                  )}
                </label>
              </div>

              <div className="assignment-hint">
                <span className="hint-chip hint-chip-node">Shapes → highlight</span>
                <span className="hint-chip hint-chip-edge">Lines → flow</span>
              </div>

              <div className="assignment-group">
                <div className="assignment-group-title">Highlighted nodes</div>
                {activeStep.highlight.length === 0 ? (
                  <p className="assignment-empty">Click a shape on the canvas</p>
                ) : (
                  <ul className="assignment-chips">
                    {activeStep.highlight.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          className="chip chip-node"
                          onClick={() => onUnassign(activeStep.id, id)}
                        >
                          {elementName(elements, id)} ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="assignment-group">
                <div className="assignment-group-title">Flow lines</div>
                {activeStep.flow.length === 0 ? (
                  <p className="assignment-empty">Click a connector line on the canvas</p>
                ) : (
                  <ul className="assignment-chips">
                    {activeStep.flow.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          className="chip chip-edge"
                          onClick={() => onUnassign(activeStep.id, id)}
                        >
                          {elementName(elements, id)} ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
