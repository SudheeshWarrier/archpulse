import React from 'react'

type Props = {
  isPlaying: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  speed: 'slow' | 'normal' | 'fast'
  setSpeed: (s: 'slow' | 'normal' | 'fast') => void
  loop: boolean
  setLoop: (v: boolean) => void
  stepCount: number
  currentStep: number
  disabled?: boolean
  isMaximized: boolean
  onToggleMaximize: () => void
}

export default function Toolbar({
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  speed,
  setSpeed,
  loop,
  setLoop,
  stepCount,
  currentStep,
  disabled,
  isMaximized,
  onToggleMaximize
}: Props) {
  return (
    <div className={`playback-bar ${disabled ? 'is-disabled' : ''}`}>
      <div className="playback-controls">
        <button type="button" className="ghost icon-btn" onClick={onPrev} disabled={disabled} aria-label="Previous step">
          ◀
        </button>
        <button
          type="button"
          className="play-btn"
          onClick={onPlayPause}
          disabled={disabled}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="ghost icon-btn" onClick={onNext} disabled={disabled} aria-label="Next step">
          ▶
        </button>
        <button
          type="button"
          className="ghost icon-btn maximize-btn"
          onClick={onToggleMaximize}
          aria-label={isMaximized ? 'Restore canvas' : 'Maximize canvas'}
        >
          {isMaximized ? '⤢' : '⤡'}
        </button>
      </div>

      <div className="playback-meta">
        Step {stepCount === 0 ? 0 : currentStep + 1} / {stepCount}
      </div>

      <div className="playback-settings">
        <label className="playback-setting">
          Speed
          <select value={speed} onChange={(e) => setSpeed(e.target.value as 'slow' | 'normal' | 'fast')} disabled={disabled}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label className="playback-setting playback-loop">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} disabled={disabled} />
          Loop
        </label>
      </div>
    </div>
  )
}
