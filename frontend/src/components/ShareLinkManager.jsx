import { useState } from 'react'
import { FiLink, FiCopy, FiTrash2, FiClock, FiEye, FiAlertCircle } from 'react-icons/fi'
import './ShareLinkManager.css'

function ShareLinkManager({ file, shareLinks, onCreateShareLink, onRevokeShareLink }) {
  const [expiresIn, setExpiresIn] = useState('24h')
  const [maxAccesses, setMaxAccesses] = useState(0)
  const [creating, setCreating] = useState(false)
  const [newShareUrl, setNewShareUrl] = useState(null)

  const handleCreateLink = async () => {
    setCreating(true)
    try {
      const result = await onCreateShareLink(file.id, { expiresIn, maxAccesses })
      setNewShareUrl(result.url)
    } catch (error) {
      console.error('Failed to create share link:', error)
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isExpired = (expiresAt) => new Date(expiresAt) < new Date()

  const getStatusBadge = (link) => {
    if (link.isRevoked) {
      return <span className="badge badge-danger">Revoked</span>
    }
    if (isExpired(link.expiresAt)) {
      return <span className="badge badge-warning">Expired</span>
    }
    if (link.maxAccesses > 0 && link.accessCount >= link.maxAccesses) {
      return <span className="badge badge-warning">Max Reached</span>
    }
    return <span className="badge badge-success">Active</span>
  }

  return (
    <div className="share-link-manager card">
      <h2>🔗 Share Links</h2>

      <div className="create-link-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="expiresIn">Expires in</label>
            <select
              id="expiresIn"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
            >
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="maxAccesses">Max accesses</label>
            <input
              id="maxAccesses"
              type="number"
              min="0"
              value={maxAccesses}
              onChange={(e) => setMaxAccesses(parseInt(e.target.value) || 0)}
              placeholder="0 = unlimited"
            />
          </div>
        </div>
        <button
          onClick={handleCreateLink}
          disabled={creating}
          className="btn-create-link"
        >
          <FiLink />
          {creating ? 'Creating...' : 'Create Share Link'}
        </button>
      </div>

      {newShareUrl && (
        <div className="new-share-url animate-fade-in">
          <div className="share-url-header">
            <FiLink />
            <span>New share link created!</span>
          </div>
          <div className="share-url-box">
            <input type="text" value={newShareUrl} readOnly />
            <button onClick={() => copyToClipboard(newShareUrl)}>
              <FiCopy />
            </button>
          </div>
        </div>
      )}

      <div className="share-links-list">
        <h3>Existing Links ({shareLinks.length})</h3>
        
        {shareLinks.length === 0 ? (
          <p className="no-links">No share links created yet</p>
        ) : (
          <ul>
            {shareLinks.map((link) => (
              <li key={link.token} className="share-link-item">
                <div className="link-info">
                  <div className="link-token">
                    <code>{link.token.substring(0, 16)}...</code>
                    {getStatusBadge(link)}
                  </div>
                  <div className="link-meta">
                    <span title="Expires at">
                      <FiClock />
                      {formatDate(link.expiresAt)}
                    </span>
                    <span title="Access count">
                      <FiEye />
                      {link.accessCount}
                      {link.maxAccesses > 0 ? ` / ${link.maxAccesses}` : ''}
                    </span>
                  </div>
                </div>
                <div className="link-actions">
                  {!link.isRevoked && !isExpired(link.expiresAt) && (
                    <>
                      <button
                        className="btn-icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/api/share/${link.token}`)}
                        title="Copy link"
                      >
                        <FiCopy />
                      </button>
                      <button
                        className="btn-icon btn-revoke"
                        onClick={() => {
                          if (window.confirm('Revoke this share link? This action cannot be undone.')) {
                            onRevokeShareLink(link.token)
                          }
                        }}
                        title="Revoke link"
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ucan-info">
        <FiAlertCircle />
        <p>
          Share links use UCAN delegations with expiration. Revoking a link invalidates
          the underlying UCAN, preventing future access even if the link is shared.
        </p>
      </div>
    </div>
  )
}

export default ShareLinkManager
