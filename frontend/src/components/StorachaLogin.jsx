import { useState, useEffect } from 'react'
import { FiUser, FiCheck, FiLoader, FiMail, FiLogOut, FiCloud, FiSettings } from 'react-icons/fi'
import storachaService from '../services/storacha'
import './StorachaLogin.css'

function StorachaLogin() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('checking') // 'checking', 'disconnected', 'awaiting-verification', 'connected', 'configured'
  const [isLoading, setIsLoading] = useState(false)
  const [spaceDid, setSpaceDid] = useState(null)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    setStatus('checking')
    try {
      await storachaService.initialize()
      const configured = storachaService.isUsingConfiguredSpace()
      setIsConfigured(configured)
      
      if (storachaService.canUploadDirectly()) {
        setStatus(configured ? 'configured' : 'connected')
        const did = storachaService.getCurrentSpaceDid()
        if (did) {
          setSpaceDid(did)
        }
      } else {
        setStatus('disconnected')
      }
    } catch (error) {
      console.error('Connection check failed:', error)
      setStatus('disconnected')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || isLoading) return

    setIsLoading(true)
    setStatus('awaiting-verification')

    try {
      const success = await storachaService.loginWithEmail(email)
      if (success) {
        setStatus('connected')
        const did = storachaService.getCurrentSpaceDid()
        if (did) {
          setSpaceDid(did)
        }
      } else {
        setStatus('disconnected')
      }
    } catch (error) {
      console.error('Login failed:', error)
      setStatus('disconnected')
    } finally {
      setIsLoading(false)
    }
  }

  const truncateDid = (did) => {
    if (!did) return ''
    return `${did.slice(0, 16)}...${did.slice(-8)}`
  }

  if (status === 'checking') {
    return (
      <div className="storacha-login card">
        <div className="login-status checking">
          <FiLoader className="spin" />
          <span>Checking connection...</span>
        </div>
      </div>
    )
  }

  // Pre-configured space via environment variables
  if (status === 'configured') {
    return (
      <div className="storacha-login card">
        <div className="login-status configured">
          <FiSettings className="status-icon configured" />
          <div className="connection-info">
            <span className="status-text">Pre-configured Space</span>
            {spaceDid && (
              <span className="space-did" title={spaceDid}>
                Space: {truncateDid(spaceDid)}
              </span>
            )}
          </div>
          <span className="badge badge-configured">Direct IPFS Upload</span>
        </div>
      </div>
    )
  }

  if (status === 'connected') {
    return (
      <div className="storacha-login card">
        <div className="login-status connected">
          <FiCloud className="status-icon connected" />
          <div className="connection-info">
            <span className="status-text">Connected to Storacha</span>
            {spaceDid && (
              <span className="space-did" title={spaceDid}>
                Space: {truncateDid(spaceDid)}
              </span>
            )}
          </div>
          <span className="badge badge-success">Direct IPFS Upload</span>
        </div>
      </div>
    )
  }

  if (status === 'awaiting-verification') {
    return (
      <div className="storacha-login card">
        <div className="login-status awaiting">
          <FiMail className="status-icon awaiting pulse" />
          <div className="awaiting-info">
            <span className="status-text">Check your email!</span>
            <span className="status-hint">Click the verification link sent to {email}</span>
          </div>
          <FiLoader className="spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="storacha-login card">
      <div className="login-header">
        <FiCloud className="header-icon" />
        <div>
          <h3>Connect to Storacha</h3>
          <p>Enable direct IPFS uploads from your browser</p>
        </div>
      </div>
      
      <form onSubmit={handleLogin} className="login-form">
        <div className="input-group">
          <FiMail className="input-icon" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={isLoading}
          />
        </div>
        <button type="submit" disabled={isLoading || !email} className="btn-login">
          {isLoading ? (
            <>
              <FiLoader className="spin" />
              Sending...
            </>
          ) : (
            <>
              <FiUser />
              Connect with Email
            </>
          )}
        </button>
      </form>
      
      <p className="login-note">
        Without login, files upload via the server (may be slower)
      </p>
    </div>
  )
}

export default StorachaLogin
