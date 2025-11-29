import { useState, useEffect } from 'react'
import { FiDownload, FiClock, FiAlertTriangle, FiFile, FiImage, FiFileText } from 'react-icons/fi'
import storachaService from '../services/storacha'
import './SharedFileView.css'

function SharedFileView({ token }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fileData, setFileData] = useState(null)

  useEffect(() => {
    if (token) {
      loadSharedFile()
    }
  }, [token])

  const loadSharedFile = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await storachaService.accessSharedFile(token)
      setFileData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getFileIcon = (contentType) => {
    if (contentType?.startsWith('image/')) return <FiImage />
    if (contentType?.includes('pdf') || contentType?.includes('document')) return <FiFileText />
    return <FiFile />
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="shared-file-view loading-state">
        <div className="spinner" />
        <p>Loading shared file...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shared-file-view error-state">
        <FiAlertTriangle className="error-icon" />
        <h2>Access Denied</h2>
        <p>{error}</p>
        <span className="error-hint">
          This link may have expired, been revoked, or reached its access limit.
        </span>
      </div>
    )
  }

  const { file, gatewayUrl, expiresAt } = fileData
  const isImage = file.contentType?.startsWith('image/')

  return (
    <div className="shared-file-view">
      <div className="shared-file-card">
        <div className="shared-file-header">
          <div className="file-icon-large">
            {getFileIcon(file.contentType)}
          </div>
          <h1>{file.name}</h1>
          <div className="file-meta">
            <span>{formatFileSize(file.size)}</span>
            <span>•</span>
            <span>{file.contentType}</span>
          </div>
        </div>

        <div className="shared-file-preview">
          {isImage ? (
            <img 
              src={gatewayUrl} 
              alt={file.name}
              className="preview-image"
            />
          ) : (
            <div className="preview-placeholder">
              {getFileIcon(file.contentType)}
              <span>Preview not available</span>
            </div>
          )}
        </div>

        <div className="shared-file-actions">
          <a 
            href={gatewayUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-download"
          >
            <FiDownload />
            Download from IPFS
          </a>
        </div>

        <div className="expiration-notice">
          <FiClock />
          <span>This link expires on {formatDate(expiresAt)}</span>
        </div>

        <div className="powered-by">
          <p>Powered by Storacha Network • Content stored on IPFS</p>
          <code className="cid-display">{file.cid}</code>
        </div>
      </div>
    </div>
  )
}

export default SharedFileView
