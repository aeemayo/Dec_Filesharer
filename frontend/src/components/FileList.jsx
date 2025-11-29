import { FiFile, FiImage, FiFileText, FiTrash2 } from 'react-icons/fi'
import './FileList.css'

function FileList({ files, selectedFile, onSelectFile, onDeleteFile }) {
  const getFileIcon = (contentType) => {
    if (contentType?.startsWith('image/')) return <FiImage />
    if (contentType?.includes('pdf') || contentType?.includes('document')) return <FiFileText />
    return <FiFile />
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (files.length === 0) {
    return (
      <div className="file-list-empty card">
        <FiFile className="empty-icon" />
        <p>No files uploaded yet</p>
        <span>Upload some files to get started</span>
      </div>
    )
  }

  return (
    <div className="file-list-container">
      {files.map((file) => (
        <div
          key={file.id}
          className={`file-card card ${selectedFile?.id === file.id ? 'selected' : ''}`}
          onClick={() => onSelectFile(file)}
        >
          <div className="file-card-icon">
            {getFileIcon(file.contentType)}
          </div>
          <div className="file-card-info">
            <span className="file-card-name" title={file.name}>
              {file.name}
            </span>
            <div className="file-card-meta">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{formatDate(file.uploadedAt)}</span>
            </div>
          </div>
          <button
            className="btn-delete"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`Delete "${file.name}"?`)) {
                onDeleteFile(file.id)
              }
            }}
            title="Delete file"
          >
            <FiTrash2 />
          </button>
        </div>
      ))}
    </div>
  )
}

export default FileList
