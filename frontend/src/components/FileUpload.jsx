import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FiUploadCloud, FiFile, FiX, FiZap } from 'react-icons/fi'
import storachaService from '../services/storacha'
import './FileUpload.css'

function FileUpload({ onUploadComplete }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadMethod, setUploadMethod] = useState('auto') // 'auto', 'direct', 'backend'

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(prev => [
      ...prev,
      ...acceptedFiles.map(file => ({
        file,
        preview: file.type.startsWith('image/') 
          ? URL.createObjectURL(file)
          : null
      }))
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  })

  const removeFile = (index) => {
    setFiles(prev => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const handleProgress = (event) => {
    switch (event.type) {
      case 'start':
        setUploadStatus(`Uploading ${event.name}...`)
        break
      case 'shard':
        setUploadStatus(`Storing chunk...`)
        break
      case 'fileComplete':
        setProgress(((event.index + 1) / event.total) * 100)
        setUploadStatus(`Uploaded ${event.index + 1}/${event.total}`)
        break
      case 'uploading':
        setUploadStatus(event.method === 'backend' ? 'Uploading via server...' : 'Uploading to IPFS...')
        break
      case 'complete':
        setProgress(100)
        setUploadStatus('Upload complete!')
        break
      default:
        break
    }
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)
    setUploadStatus('Initializing...')

    try {
      // Use storacha service for direct uploads
      const fileList = files.map(f => f.file)
      const data = await storachaService.uploadFiles(fileList, handleProgress)
      
      // Clean up previews
      files.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview)
      })
      
      setFiles([])
      setProgress(100)
      setUploadStatus('')
      
      if (onUploadComplete) {
        onUploadComplete(data.files)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('')
      alert('Failed to upload files. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="file-upload card">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
      >
        <input {...getInputProps()} />
        <FiUploadCloud className="dropzone-icon" />
        {isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <>
            <p>Drag & drop files here, or click to select</p>
            <span className="dropzone-hint">
              Supports images, PDFs, and documents (max 100MB)
            </span>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h3>Files to upload ({files.length})</h3>
          <ul>
            {files.map(({ file, preview }, index) => (
              <li key={`${file.name}-${index}`} className="file-item animate-fade-in">
                {preview ? (
                  <img src={preview} alt={file.name} className="file-preview" />
                ) : (
                  <div className="file-icon">
                    <FiFile />
                  </div>
                )}
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <FiX />
                </button>
              </li>
            ))}
          </ul>

          <div className="upload-actions">
            {uploading && (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {uploadStatus && (
                  <div className="upload-status">
                    <FiZap className="status-icon" />
                    {uploadStatus}
                  </div>
                )}
              </>
            )}
            <button
              onClick={uploadFiles}
              disabled={uploading || files.length === 0}
              className="btn-upload"
            >
              {uploading ? 'Uploading...' : `Upload ${files.length} file(s) to IPFS`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUpload
