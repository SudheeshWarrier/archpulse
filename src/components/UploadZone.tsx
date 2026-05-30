import React, { useCallback } from 'react'

type Props = { onLoad: (svg: string) => void }

export default function UploadZone({ onLoad }: Props) {
  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result ?? '')
        onLoad(text)
      }
      reader.readAsText(file)
    },
    [onLoad]
  )

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && f.name.toLowerCase().endsWith('.svg')) handleFile(f)
  }

  return (
    <div className="uploader compact" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <label className="upload-label">
        <span>Upload SVG</span>
        <input type="file" accept=".svg" onChange={onChange} />
      </label>
      <span className="upload-hint">or drop file</span>
    </div>
  )
}
