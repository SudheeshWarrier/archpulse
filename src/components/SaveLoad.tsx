import React, { useState } from 'react'
import { exportProject, importProjectFile } from '../utils/io'
import { exportAnimatedGif } from '../utils/exportGif'
import type { ProjectState } from '../schema/projectSchema'
import type { ProjectDispatch } from '../hooks/useProjectReducer'

export default function SaveLoad({
  state,
  dispatch
}: {
  state: ProjectState
  dispatch: ProjectDispatch
}) {
  const [isExportingGif, setIsExportingGif] = useState(false)

  const onExport = () => exportProject(state)

  const onExportGif = async () => {
    if (!state.svg || state.steps.length === 0) {
      alert('Add at least one animation step before exporting GIF.')
      return
    }

    try {
      setIsExportingGif(true)
      await exportAnimatedGif(state.svg, state.steps)
    } catch (err) {
      console.error(err)
      alert('Failed to export GIF. Please try again.')
    } finally {
      setIsExportingGif(false)
    }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const project = await importProjectFile(f)
      dispatch({ type: 'SET_PROJECT', payload: project })
    } catch (err) {
      console.error(err)
      alert('Invalid project file')
    }
  }

  return (
    <div className="save-load">
      <button type="button" className="ghost" onClick={onExport} disabled={!state.svg}>
        Save project
      </button>
      <button
        type="button"
        className="ghost"
        onClick={onExportGif}
        disabled={!state.svg || state.steps.length === 0 || isExportingGif}
      >
        {isExportingGif ? 'Exporting GIF...' : 'Export GIF'}
      </button>
      <label className="ghost file-btn">
        <input
          type="file"
          accept=".json,.archpulse.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        Load project
      </label>
    </div>
  )
}
