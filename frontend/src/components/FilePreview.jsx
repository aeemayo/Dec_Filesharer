import { FiExternalLink, FiCopy, FiFile, FiImage, FiFileText } from 'react-icons/fi'
import './FilePreview.css'

function FilePreview({ file }) {
  const isImage = file.contentType?.startsWith('image/')
  const isPdf = file.contentType?.includes('pdf')

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="file-preview card">
      <h2>📄 File Details</h2>
      
      <div className="preview-container">
        {isImage ? (
          <img 
            src={file.gatewayUrl} 
            alt={file.name}
            className="preview-image"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        
        <div className={`preview-placeholder ${isImage ? 'hidden' : ''}`}>
          {isPdf ? <FiFileText /> : isImage ? <FiImage /> : <FiFile />}
          <span>{file.contentType || 'Unknown type'}</span>
        </div>
      </div>

      <div className="file-details">
        <div className="detail-row">
          <span className="detail-label">Name</span>
          <span className="detail-value">{file.name}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Size</span>
          <span className="detail-value">{formatFileSize(file.size)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Type</span>
          <span className="detail-value">{file.contentType || 'Unknown'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">CID</span>
          <span className="detail-value cid-value" title={file.cid}>
            {file.cid?.substring(0, 20)}...
            <button 
              className="btn-icon"
              onClick={() => copyToClipboard(file.cid)}
              title="Copy CID"
            >
              <FiCopy />
            </button>
          </span>
        </div>
      </div>

      <div className="preview-actions">
        <a 
          href={file.gatewayUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-gateway"
        >
          <FiExternalLink />
          Open on IPFS Gateway
        </a>
        <button 
          className="secondary"
          onClick={() => copyToClipboard(file.gatewayUrl)}
        >
          <FiCopy />
          Copy Gateway URL
        </button>
      </div>
    </div>
  )
}

export default FilePreview
