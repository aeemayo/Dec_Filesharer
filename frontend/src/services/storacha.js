/**
 * Storacha/w3up client service for decentralized file uploads
 * 
 * This module integrates with the @storacha/client for direct browser-to-IPFS uploads
 * Users must sign in with their email to upload files.
 */

import * as Client from '@storacha/client'

// Use environment variable for API URL, fallback to /api for local dev
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

/**
 * StorachaService handles direct uploads to Storacha network
 */
class StorachaService {
  constructor() {
    this.client = null
    this.initialized = false
    this.initPromise = null
  }

  /**
   * Initialize the Storacha client with agent and space
   */
  async initialize() {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise
    }
    
    if (this.initialized && this.client) {
      return
    }

    this.initPromise = this._doInitialize()
    
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  async _doInitialize() {
    try {
      // Create a new client (this creates a new agent)
      this.client = await Client.create()
      
      // Check if we already have a space from previous login (stored in localStorage)
      const spaces = this.client.spaces()
      if (spaces.length > 0) {
        await this.client.setCurrentSpace(spaces[0].did())
        this.initialized = true
        console.log('Storacha client initialized with existing space:', spaces[0].did())
        return
      }

      // No space - user needs to login with email
      this.initialized = true
      console.log('Storacha client initialized (no space - login required)')
    } catch (error) {
      console.error('Failed to initialize Storacha client:', error)
      this.initialized = true
    }
  }

  /**
   * Check if direct upload is available (has configured space)
   */
  canUploadDirectly() {
    return this.client && this.client.currentSpace()
  }

  /**
   * Get the current space DID
   */
  getCurrentSpaceDid() {
    return this.client?.currentSpace()?.did() || null
  }

  /**
   * Login with email to get access to Storacha space
   * @param {string} email - User's email
   * @returns {Promise<boolean>} - Whether login was initiated
   */
  async loginWithEmail(email) {
    if (!this.client) {
      await this.initialize()
    }

    try {
      const account = await this.client.login(email)
      
      // Wait for email verification
      console.log('Check your email for verification link...')
      
      // This will wait for the user to click the email link
      await account.plan.wait()
      
      // After verification, get the space
      const spaces = this.client.spaces()
      if (spaces.length > 0) {
        await this.client.setCurrentSpace(spaces[0].did())
        return true
      }
      
      // If no space, create one
      const space = await this.client.createSpace('dec-filesharer')
      await this.client.setCurrentSpace(space.did())
      await this.client.addSpace(await space.createRecovery(account.did()))
      await space.save()
      
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  /**
   * Upload a single file directly to Storacha
   * @param {File} file - The file to upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Upload result with CID
   */
  async uploadFile(file, onProgress) {
    await this.initialize()

    // Require login to upload
    if (!this.canUploadDirectly()) {
      throw new Error('Please sign in with your email to upload files')
    }

    onProgress?.({ type: 'start', name: file.name })
    
    const cid = await this.client.uploadFile(file, {
      onShardStored: (meta) => {
        onProgress?.({ type: 'shard', cid: meta.cid.toString(), size: meta.size })
      }
    })

    const cidString = cid.toString()
    
    // Register the file with our backend
    const registered = await this.registerFileWithBackend({
      name: file.name,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      cid: cidString
    })

    onProgress?.({ type: 'complete', cid: cidString })
    
    return {
      files: [registered.file],
      message: 'Successfully uploaded 1 file'
    }
  }

  /**
   * Upload multiple files directly to Storacha
   * @param {File[]} files - The files to upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Upload result with CIDs
   */
  async uploadFiles(files, onProgress) {
    await this.initialize()

    // Require login to upload
    if (!this.canUploadDirectly()) {
      throw new Error('Please sign in with your email to upload files')
    }

    const uploadedFiles = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      onProgress?.({ type: 'start', name: file.name, index: i, total: files.length })
      
      const cid = await this.client.uploadFile(file, {
        onShardStored: (meta) => {
          onProgress?.({ type: 'shard', cid: meta.cid.toString(), size: meta.size })
        }
      })

      const cidString = cid.toString()
      
      // Register each file with backend
      const registered = await this.registerFileWithBackend({
        name: file.name,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
        cid: cidString
      })

      uploadedFiles.push(registered.file)
      onProgress?.({ type: 'fileComplete', name: file.name, cid: cidString, index: i })
    }

    onProgress?.({ type: 'complete', count: uploadedFiles.length })
    
    return {
      files: uploadedFiles,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`
    }
  }

  /**
   * Register a file that was uploaded directly with the backend
   * @param {Object} fileInfo - File info (name, size, contentType, cid)
   * @returns {Promise<Object>} - Registered file metadata
   */
  async registerFileWithBackend(fileInfo) {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fileInfo)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to register file')
    }

    return await response.json()
  }

  /**
   * Get the IPFS gateway URL for a CID
   * @param {string} cid - The content identifier
   * @returns {string} - The gateway URL
   */
  getGatewayUrl(cid) {
    // Multiple gateway options
    const gateways = [
      `https://w3s.link/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://${cid}.ipfs.w3s.link`,
      `https://${cid}.ipfs.dweb.link`,
    ]
    return gateways[0]
  }

  /**
   * Create a shareable link with expiration
   * @param {string} fileId - The file ID
   * @param {Object} options - Share options (expiresIn, maxAccesses)
   * @returns {Promise<Object>} - Share link info
   */
  async createShareLink(fileId, options = {}) {
    const response = await fetch(`${API_BASE}/files/${fileId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      throw new Error('Failed to create share link')
    }

    return await response.json()
  }

  /**
   * Revoke a share link (UCAN revocation)
   * @param {string} token - The share link token
   * @returns {Promise<void>}
   */
  async revokeShareLink(token) {
    const response = await fetch(`${API_BASE}/share/${token}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to revoke share link')
    }
  }

  /**
   * Access a shared file
   * @param {string} token - The share link token
   * @returns {Promise<Object>} - File info and gateway URL
   */
  async accessSharedFile(token) {
    const response = await fetch(`${API_BASE}/share/${token}`)
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Access denied')
    }

    return await response.json()
  }
}

// Export singleton instance
export const storachaService = new StorachaService()
export default storachaService
