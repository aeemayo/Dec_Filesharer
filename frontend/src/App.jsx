import { useState, useEffect } from 'react'
import FileUpload from './components/FileUpload'
import FileList from './components/FileList'
import FilePreview from './components/FilePreview'
import ShareLinkManager from './components/ShareLinkManager'
import StorachaLogin from './components/StorachaLogin'
import './App.css'

// API base URL - uses env variable in production, proxy in development
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

function App() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [shareLinks, setShareLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)

  // Fetch files on mount
  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/files`)
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Failed to fetch files:', error)
      showNotification('Failed to fetch files', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadComplete = (uploadedFiles) => {
    setFiles(prev => [...uploadedFiles, ...prev])
    showNotification(`Successfully uploaded ${uploadedFiles.length} file(s)`, 'success')
  }

  const handleFileSelect = async (file) => {
    setSelectedFile(file)
    // Fetch share links for this file
    try {
      const response = await fetch(`${API_BASE}/files/${file.id}`)
      const data = await response.json()
      setShareLinks(data.shareLinks || [])
    } catch (error) {
      console.error('Failed to fetch file details:', error)
    }
  }

  const handleDeleteFile = async (fileId) => {
    try {
      const response = await fetch(`${API_BASE}/files/${fileId}`, { method: 'DELETE' })
      if (response.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileId))
        if (selectedFile?.id === fileId) {
          setSelectedFile(null)
          setShareLinks([])
        }
        showNotification('File deleted successfully', 'success')
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
      showNotification('Failed to delete file', 'error')
    }
  }

  const handleCreateShareLink = async (fileId, options) => {
    try {
      const response = await fetch(`${API_BASE}/files/${fileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })
      const data = await response.json()
      setShareLinks(prev => [data.shareLink, ...prev])
      showNotification('Share link created!', 'success')
      return data
    } catch (error) {
      console.error('Failed to create share link:', error)
      showNotification('Failed to create share link', 'error')
      throw error
    }
  }

  const handleRevokeShareLink = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/share/${token}`, { method: 'DELETE' })
      if (response.ok) {
        setShareLinks(prev => 
          prev.map(link => 
            link.token === token 
              ? { ...link, isRevoked: true, revokedAt: new Date().toISOString() }
              : link
          )
        )
        showNotification('Share link revoked', 'success')
      }
    } catch (error) {
      console.error('Failed to revoke share link:', error)
      showNotification('Failed to revoke share link', 'error')
    }
  }

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔗 Dec FileSharer</h1>
        <p className="subtitle">Decentralized file sharing with UCAN-based expiration</p>
      </header>

      {notification && (
        <div className={`notification notification-${notification.type} animate-fade-in`}>
          {notification.message}
        </div>
      )}

      <main className="app-main">
        <section className="upload-section">
          <StorachaLogin />
          <FileUpload onUploadComplete={handleUploadComplete} />
        </section>

        <div className="content-grid">
          <section className="files-section">
            <h2>📁 Your Files</h2>
            {loading ? (
              <div className="loading">Loading files...</div>
            ) : (
              <FileList
                files={files}
                selectedFile={selectedFile}
                onSelectFile={handleFileSelect}
                onDeleteFile={handleDeleteFile}
              />
            )}
          </section>

          <section className="details-section">
            {selectedFile ? (
              <>
                <FilePreview file={selectedFile} />
                <ShareLinkManager
                  file={selectedFile}
                  shareLinks={shareLinks}
                  onCreateShareLink={handleCreateShareLink}
                  onRevokeShareLink={handleRevokeShareLink}
                />
              </>
            ) : (
              <div className="card empty-state">
                <p>Select a file to view details and manage share links</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by Storacha Network & IPFS • UCAN-based authorization</p>
      </footer>
    </div>
  )
}

export default App
