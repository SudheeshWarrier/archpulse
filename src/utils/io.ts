import ProjectStateSchema, { ProjectState } from '../schema/projectSchema'

export function exportProject(state: ProjectState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'project.archpulse.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function importProjectFile(file: File): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const txt = String(reader.result ?? '')
        const parsed = JSON.parse(txt)
        const validated = ProjectStateSchema.parse(parsed)
        resolve(validated)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed reading file'))
    reader.readAsText(file)
  })
}
