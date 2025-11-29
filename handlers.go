package main

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler contains HTTP handlers for the API
type Handler struct {
	storage  *StorageService
	fileRepo *FileRepository
	config   *Config
}

// NewHandler creates a new handler
func NewHandler(storage *StorageService, fileRepo *FileRepository, config *Config) *Handler {
	return &Handler{
		storage:  storage,
		fileRepo: fileRepo,
		config:   config,
	}
}

// Upload handles file uploads
func (h *Handler) Upload(c *gin.Context) {
	// Parse multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form"})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		// Try single file upload
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No files provided"})
			return
		}
		files = append(files, file)
	}

	var uploadedFiles []*FileMetadata

	for _, file := range files {
		// Check file size
		if file.Size > h.config.MaxFileSize {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("File %s exceeds maximum size of %d bytes", file.Filename, h.config.MaxFileSize),
			})
			return
		}

		// Open file
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
			return
		}
		defer src.Close()

		// Read file content
		content, err := io.ReadAll(src)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file content"})
			return
		}

		// Detect content type
		contentType := http.DetectContentType(content)

		// Upload to storage
		result, err := h.storage.Upload(content, file.Filename, contentType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to upload: %v", err)})
			return
		}

		// Create file metadata
		metadata := &FileMetadata{
			ID:          GenerateID(),
			Name:        file.Filename,
			Size:        file.Size,
			ContentType: contentType,
			CID:         result.CID,
			UploadedAt:  time.Now(),
			GatewayURL:  result.GatewayURL,
		}

		// Save metadata
		if err := h.fileRepo.SaveFile(metadata); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file metadata"})
			return
		}

		uploadedFiles = append(uploadedFiles, metadata)
	}

	c.JSON(http.StatusOK, gin.H{
		"files":   uploadedFiles,
		"message": fmt.Sprintf("Successfully uploaded %d file(s)", len(uploadedFiles)),
	})
}

// ListFiles returns all uploaded files
func (h *Handler) ListFiles(c *gin.Context) {
	files := h.fileRepo.ListFiles()
	c.JSON(http.StatusOK, gin.H{"files": files})
}

// GetFile returns a specific file's metadata
func (h *Handler) GetFile(c *gin.Context) {
	id := c.Param("id")

	file, exists := h.fileRepo.GetFile(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Get share links for this file
	shareLinks := h.fileRepo.GetShareLinksForFile(id)

	c.JSON(http.StatusOK, gin.H{
		"file":       file,
		"shareLinks": shareLinks,
	})
}

// DeleteFile removes a file
func (h *Handler) DeleteFile(c *gin.Context) {
	id := c.Param("id")

	if !h.fileRepo.DeleteFile(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

// CreateShareLink creates a shareable link for a file with expiration
func (h *Handler) CreateShareLink(c *gin.Context) {
	fileID := c.Param("id")

	file, exists := h.fileRepo.GetFile(fileID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	var req ShareLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Use defaults if no body provided
		req.ExpiresIn = "24h"
		req.MaxAccesses = 0
	}

	// Parse expiration duration
	duration, err := ParseDuration(req.ExpiresIn)
	if err != nil {
		duration = h.config.DefaultExpiration
	}

	// Generate share link
	token := GenerateToken()
	now := time.Now()

	shareLink := &ShareLink{
		Token:        token,
		FileID:       fileID,
		CID:          file.CID,
		CreatedAt:    now,
		ExpiresAt:    now.Add(duration),
		IsRevoked:    false,
		DelegationID: GenerateID(), // In production, this would be the actual UCAN delegation ID
		MaxAccesses:  req.MaxAccesses,
	}

	if err := h.fileRepo.SaveShareLink(shareLink); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create share link"})
		return
	}

	// Build shareable URL
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	shareURL := fmt.Sprintf("%s://%s/api/share/%s", scheme, c.Request.Host, token)

	c.JSON(http.StatusOK, ShareLinkResponse{
		ShareLink: shareLink,
		URL:       shareURL,
	})
}

// GetSharedFile serves a file via its share token
func (h *Handler) GetSharedFile(c *gin.Context) {
	token := c.Param("token")

	shareLink, exists := h.fileRepo.GetShareLink(token)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	// Verify access is still valid
	if !h.storage.VerifyAccess(shareLink) {
		reason := "Access denied"
		if shareLink.IsRevoked {
			reason = "This share link has been revoked"
		} else if time.Now().After(shareLink.ExpiresAt) {
			reason = "This share link has expired"
		} else if shareLink.MaxAccesses > 0 && shareLink.AccessCount >= shareLink.MaxAccesses {
			reason = "This share link has reached its maximum access count"
		}
		c.JSON(http.StatusForbidden, gin.H{"error": reason})
		return
	}

	// Get file metadata
	file, exists := h.fileRepo.GetFile(shareLink.FileID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "File no longer exists"})
		return
	}

	// Increment access count
	h.fileRepo.IncrementAccessCount(token)

	// Return file info with gateway URL
	c.JSON(http.StatusOK, gin.H{
		"file":       file,
		"gatewayUrl": h.storage.GetGatewayURL(shareLink.CID),
		"expiresAt":  shareLink.ExpiresAt,
	})
}

// RevokeShareLink revokes a share link (UCAN revocation)
func (h *Handler) RevokeShareLink(c *gin.Context) {
	token := c.Param("token")

	shareLink, exists := h.fileRepo.GetShareLink(token)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	// Revoke the UCAN delegation
	if err := h.storage.RevokeAccess(shareLink.DelegationID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke access"})
		return
	}

	// Mark as revoked in our records
	h.fileRepo.RevokeShareLink(token)

	c.JSON(http.StatusOK, gin.H{"message": "Share link revoked successfully"})
}

// CreateDelegation creates a UCAN delegation for client-side uploads
func (h *Handler) CreateDelegation(c *gin.Context) {
	clientDID := c.Param("did")

	if clientDID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Client DID required"})
		return
	}

	// Validate DID format (should start with did:key:)
	if len(clientDID) < 8 || clientDID[:8] != "did:key:" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid DID format. Expected did:key:..."})
		return
	}

	// Create delegation with 24-hour expiration
	delegation, err := h.storage.CreateDelegation(clientDID, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create delegation"})
		return
	}

	c.Data(http.StatusOK, "application/octet-stream", delegation)
}
