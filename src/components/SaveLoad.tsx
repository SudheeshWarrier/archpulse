import React from 'react'
import { exportProject, importProjectFile } from '../utils/io'
import type { ProjectState } from '../schema/projectSchema'
import type { ProjectDispatch } from '../hooks/useProjectReducer'

export default function SaveLoad({
  state,
  dispatch
}: {
  state: ProjectState
  dispatch: ProjectDispatch
}) {
  const onExport = () => exportProject(state)

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
