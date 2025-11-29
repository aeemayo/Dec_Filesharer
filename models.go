package main

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// FileMetadata represents uploaded file information
type FileMetadata struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Size        int64     `json:"size"`
	ContentType string    `json:"contentType"`
	CID         string    `json:"cid"` // IPFS Content Identifier
	UploadedAt  time.Time `json:"uploadedAt"`
	GatewayURL  string    `json:"gatewayUrl"`
}

// ShareLink represents a shareable link with expiration
type ShareLink struct {
	Token        string     `json:"token"`
	FileID       string     `json:"fileId"`
	CID          string     `json:"cid"`
	CreatedAt    time.Time  `json:"createdAt"`
	ExpiresAt    time.Time  `json:"expiresAt"`
	IsRevoked    bool       `json:"isRevoked"`
	RevokedAt    *time.Time `json:"revokedAt,omitempty"`
	DelegationID string     `json:"delegationId,omitempty"` // UCAN delegation identifier
	AccessCount  int        `json:"accessCount"`
	MaxAccesses  int        `json:"maxAccesses,omitempty"` // 0 = unlimited
}

// ShareLinkRequest is the request body for creating a share link
type ShareLinkRequest struct {
	ExpiresIn   string `json:"expiresIn"`   // Duration string like "24h", "7d"
	MaxAccesses int    `json:"maxAccesses"` // Maximum number of accesses (0 = unlimited)
}

// UploadResponse is returned after successful upload
type UploadResponse struct {
	File       *FileMetadata `json:"file"`
	GatewayURL string        `json:"gatewayUrl"`
}

// ShareLinkResponse is returned when creating a share link
type ShareLinkResponse struct {
	ShareLink *ShareLink `json:"shareLink"`
	URL       string     `json:"url"` // Full shareable URL
}

// FileRepository stores file metadata (in-memory for demo)
type FileRepository struct {
	files      map[string]*FileMetadata
	shareLinks map[string]*ShareLink
	mu         sync.RWMutex
}

// NewFileRepository creates a new file repository
func NewFileRepository() *FileRepository {
	return &FileRepository{
		files:      make(map[string]*FileMetadata),
		shareLinks: make(map[string]*ShareLink),
	}
}

// SaveFile stores file metadata
func (r *FileRepository) SaveFile(file *FileMetadata) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.files[file.ID] = file
	return nil
}

// GetFile retrieves file metadata by ID
func (r *FileRepository) GetFile(id string) (*FileMetadata, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	file, exists := r.files[id]
	return file, exists
}

// ListFiles returns all files
func (r *FileRepository) ListFiles() []*FileMetadata {
	r.mu.RLock()
	defer r.mu.RUnlock()
	files := make([]*FileMetadata, 0, len(r.files))
	for _, f := range r.files {
		files = append(files, f)
	}
	return files
}

// DeleteFile removes file metadata
func (r *FileRepository) DeleteFile(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.files[id]; exists {
		delete(r.files, id)
		return true
	}
	return false
}

// SaveShareLink stores a share link
func (r *FileRepository) SaveShareLink(link *ShareLink) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.shareLinks[link.Token] = link
	return nil
}

// GetShareLink retrieves a share link by token
func (r *FileRepository) GetShareLink(token string) (*ShareLink, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	link, exists := r.shareLinks[token]
	return link, exists
}

// IncrementAccessCount increments the access count for a share link
func (r *FileRepository) IncrementAccessCount(token string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if link, exists := r.shareLinks[token]; exists {
		link.AccessCount++
	}
}

// RevokeShareLink marks a share link as revoked
func (r *FileRepository) RevokeShareLink(token string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if link, exists := r.shareLinks[token]; exists {
		now := time.Now()
		link.IsRevoked = true
		link.RevokedAt = &now
		return true
	}
	return false
}

// GetShareLinksForFile returns all share links for a file
func (r *FileRepository) GetShareLinksForFile(fileID string) []*ShareLink {
	r.mu.RLock()
	defer r.mu.RUnlock()
	links := make([]*ShareLink, 0)
	for _, link := range r.shareLinks {
		if link.FileID == fileID {
			links = append(links, link)
		}
	}
	return links
}

// GenerateID generates a random ID
func GenerateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// GenerateToken generates a random share token
func GenerateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ParseDuration parses a duration string with support for days
func ParseDuration(s string) (time.Duration, error) {
	// Handle days (e.g., "7d")
	if len(s) > 1 && s[len(s)-1] == 'd' {
		var days int
		_, err := time.ParseDuration(s[:len(s)-1] + "h")
		if err != nil {
			// Try parsing as integer days
			if n, err := time.ParseDuration("1h"); err == nil {
				for i := 0; i < len(s)-1; i++ {
					if s[i] >= '0' && s[i] <= '9' {
						days = days*10 + int(s[i]-'0')
					}
				}
				return time.Duration(days) * 24 * n, nil
			}
		}
	}
	return time.ParseDuration(s)
}
