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
        <span className="material-icons" aria-hidden="true">save</span>
        Save
      </button>
      <button
        type="button"
        className="ghost"
        onClick={onExportGif}
        disabled={!state.svg || state.steps.length === 0 || isExportingGif}
      >
        <span className="material-icons" aria-hidden="true">
          {isExportingGif ? 'hourglass_top' : 'movie'}
        </span>
        {isExportingGif ? 'Exporting...' : 'GIF'}
      </button>
      <label className="ghost file-btn">
        <input
          type="file"
          accept=".json,.archpulse.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <span className="material-icons" aria-hidden="true">folder_open</span>
        Load
      </label>
    </div>
  )
}
