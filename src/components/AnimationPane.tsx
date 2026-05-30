import React from 'react'
import { AnimationStep, ArchElement } from '../types'

type Props = {
  steps: AnimationStep[]
  elements: Record<string, ArchElement>
  editingIndex: number
  playingIndex: number | null
  onEditingIndexChange: (index: number) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdateLabel: (stepId: string, label: string) => void
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
  onUpdateLabel,
  onUnassign,
  onSuggest,
  hasSvg
}: Props) {
  const activeStep = steps[editingIndex] ?? null

  return (
    <aside className="animation-pane">
      <header className="animation-pane-header">
        <div>
          <h2>Animations</h2>
          <p>{steps.length > 0 ? `${steps.length} steps` : 'Select a step, then click the canvas.'}</p>
        </div>
        <div className="animation-pane-actions">
          <button type="button" className="ghost" onClick={onAdd} disabled={!hasSvg}>
            + Step
          </button>
          <button type="button" className="secondary" onClick={onSuggest} disabled={!hasSvg}>
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
          <ol className="step-timeline" aria-label="Animation steps">
            {steps.map((step, index) => {
              const isEditing = index === editingIndex
              const isPlaying = playingIndex === index
              const nodeCount = step.highlight.length
              const edgeCount = step.flow.length

              return (
                <li key={step.id}>
                  <button
                    type="button"
                    className={`step-timeline-row ${isEditing ? 'is-editing' : ''} ${isPlaying ? 'is-playing' : ''}`}
                    onClick={() => onEditingIndexChange(index)}
                    aria-current={isEditing ? 'step' : undefined}
                  >
                    <span className="step-timeline-num">{index + 1}</span>
                    <span className="step-timeline-body">
                      <span className="step-timeline-label">
                        {step.label || `Animation ${index + 1}`}
                      </span>
                      <span className="step-timeline-meta">
                        {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {edgeCount} line
                        {edgeCount !== 1 ? 's' : ''}
                      </span>
                    </span>
                    {isPlaying && <span className="step-playing-badge">▶</span>}
                  </button>
                </li>
              )
            })}
          </ol>

          {activeStep && (
            <div className="step-detail">
              <div className="step-detail-header">
                <span className="step-detail-num">Step {editingIndex + 1} details</span>
                <button
                  type="button"
                  className="ghost danger-text step-detail-delete"
                  onClick={() => onRemove(activeStep.id)}
                >
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
