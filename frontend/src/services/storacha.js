/**
 * Storacha/w3up client service for decentralized file uploads
 * 
 * This module integrates with the @storacha/client for client-side uploads
 * using UCAN delegations from the backend server.
 */

// Note: In production, you would import from @storacha/client
// import * as Client from '@storacha/client'
// import * as Delegation from '@storacha/client/delegation'

// Use environment variable for API URL, fallback to /api for local dev
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

/**
 * StorachaService handles interactions with Storacha network
 */
class StorachaService {
  constructor() {
    this.client = null
    this.initialized = false
  }

  /**
   * Initialize the Storacha client
   * In production, this would create a w3up client and setup delegations
   */
  async initialize() {
    if (this.initialized) return

    try {
      // In production with @storacha/client:
      // this.client = await Client.create()
      // const did = this.client.agent.did()
      // const delegation = await this.fetchDelegation(did)
      // await this.client.addSpace(delegation)
      
      this.initialized = true
      console.log('Storacha client initialized')
    } catch (error) {
      console.error('Failed to initialize Storacha client:', error)
      throw error
    }
  }

  /**
   * Fetch a UCAN delegation from the backend
   * @param {string} did - The client's DID
   * @returns {Promise<Uint8Array>} - The delegation bytes
   */
  async fetchDelegation(did) {
    const response = await fetch(`${API_BASE}/delegation/${encodeURIComponent(did)}`)
    if (!response.ok) {
      throw new Error('Failed to fetch delegation')
    }
    const data = await response.arrayBuffer()
    return new Uint8Array(data)
  }

  /**
   * Upload a file using client-side upload with UCAN delegation
   * @param {File} file - The file to upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Upload result with CID
   */
  async uploadFile(file, onProgress) {
    await this.initialize()

    // In production with @storacha/client:
    // const cid = await this.client.uploadFile(file, {
    //   onShardStored: ({ cid }) => {
    //     onProgress?.({ type: 'shard', cid: cid.toString() })
    //   }
    // })
    // return { cid: cid.toString() }

    // For now, use the backend upload endpoint
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    return await response.json()
  }

  /**
   * Upload multiple files
   * @param {File[]} files - The files to upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Upload result with CIDs
   */
  async uploadFiles(files, onProgress) {
    await this.initialize()

    // In production with @storacha/client:
    // const cid = await this.client.uploadDirectory(files, {
    //   onDirectoryEntryLink: ({ name, cid }) => {
    //     onProgress?.({ type: 'entry', name, cid: cid.toString() })
    //   }
    // })
    // return { cid: cid.toString() }

    // For now, use the backend upload endpoint
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
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
