package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// StorageService handles file storage operations with Storacha/IPFS
type StorageService struct {
	config *Config
	client *http.Client
}

// NewStorageService creates a new storage service
func NewStorageService(cfg *Config) (*StorageService, error) {
	return &StorageService{
		config: cfg,
		client: &http.Client{
			Timeout: 5 * time.Minute,
		},
	}, nil
}

// UploadResult contains the result of an upload operation
type UploadResult struct {
	CID        string
	GatewayURL string
}

// Upload uploads file content to Storacha using the CLI
// This uses the storacha CLI which handles all the UCAN complexity
func (s *StorageService) Upload(content []byte, filename string, contentType string) (*UploadResult, error) {
	// Create a temporary file to upload
	tmpDir := os.TempDir()
	tmpFile := filepath.Join(tmpDir, fmt.Sprintf("upload_%d_%s", time.Now().UnixNano(), sanitizeFilename(filename)))

	// Write content to temp file
	if err := os.WriteFile(tmpFile, content, 0644); err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile)

	// Use storacha CLI to upload
	// The CLI uses the logged-in credentials
	cmd := exec.Command("storacha", "up", tmpFile, "--json")
	output, err := cmd.CombinedOutput()

	log.Printf("Storacha CLI output: %s", string(output))

	if err != nil {
		log.Printf("Storacha CLI error: %s", string(output))
		return nil, fmt.Errorf("storacha upload failed: %w - %s", err, string(output))
	}

	// Parse the JSON output to get CID
	// The format is: {"root":{"/":"bafyba..."}}
	var result struct {
		Root struct {
			CID string `json:"/"`
		} `json:"root"`
	}

	// The output might have multiple lines, find the JSON
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "{") {
			if err := json.Unmarshal([]byte(line), &result); err == nil && result.Root.CID != "" {
				break
			}
		}
	}

	cidStr := result.Root.CID

	if cidStr == "" {
		// Try to extract CID from plain output (bafyba...)
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "bafy") || strings.HasPrefix(line, "bafk") {
				cidStr = strings.Fields(line)[0] // Get first word
				break
			}
		}
	}

	if cidStr == "" {
		return nil, fmt.Errorf("could not parse CID from output: %s", string(output))
	}
	log.Printf("Uploaded file %s to Storacha with CID: %s", filename, cidStr)

	gatewayURL := fmt.Sprintf("%s/%s", s.config.IPFSGateway, cidStr)

	return &UploadResult{
		CID:        cidStr,
		GatewayURL: gatewayURL,
	}, nil
}

// sanitizeFilename removes problematic characters from filename
func sanitizeFilename(name string) string {
	// Replace spaces and special characters
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	return name
}

// CreateDelegation creates a UCAN delegation for a client DID
// This allows the client to upload directly to Storacha
func (s *StorageService) CreateDelegation(clientDID string, expiration time.Duration) ([]byte, error) {
	// In a full implementation with guppy and go-ucanto:
	// 1. Parse the client DID
	// 2. Create delegation with space/blob/add, space/index/add, upload/add capabilities
	// 3. Set expiration
	// 4. Archive and return the delegation bytes

	// For now, create a mock delegation structure
	delegation := struct {
		Audience   string   `json:"aud"`
		Issuer     string   `json:"iss"`
		Expiration int64    `json:"exp"`
		Abilities  []string `json:"att"`
	}{
		Audience:   clientDID,
		Issuer:     s.config.SpaceDID,
		Expiration: time.Now().Add(expiration).Unix(),
		Abilities: []string{
			"space/blob/add",
			"space/index/add",
			"filecoin/offer",
			"upload/add",
		},
	}

	// In production, this would be a proper UCAN token
	// For demo purposes, we return a base64-encoded JSON
	delegationJSON := fmt.Sprintf(
		`{"aud":"%s","iss":"%s","exp":%d,"att":["%s"]}`,
		delegation.Audience,
		delegation.Issuer,
		delegation.Expiration,
		strings.Join(delegation.Abilities, `","`),
	)

	return []byte(base64.StdEncoding.EncodeToString([]byte(delegationJSON))), nil
}

// RevokeAccess revokes access to a CID by invalidating delegations
// In UCAN, revocation works by publishing a revocation to the revocation service
func (s *StorageService) RevokeAccess(delegationID string) error {
	// In a full implementation:
	// 1. Create a revocation UCAN
	// 2. Publish to Storacha's revocation service
	// 3. The gateway will check revocation status before serving content

	log.Printf("Revoking delegation: %s", delegationID)
	return nil
}

// GetGatewayURL returns the gateway URL for a CID
func (s *StorageService) GetGatewayURL(cidStr string) string {
	return fmt.Sprintf("%s/%s", s.config.IPFSGateway, cidStr)
}

// VerifyAccess checks if a delegation is still valid (not revoked, not expired)
func (s *StorageService) VerifyAccess(link *ShareLink) bool {
	// Check if revoked
	if link.IsRevoked {
		return false
	}

	// Check expiration
	if time.Now().After(link.ExpiresAt) {
		return false
	}

	// Check max accesses
	if link.MaxAccesses > 0 && link.AccessCount >= link.MaxAccesses {
		return false
	}

	return true
}

// FetchFromGateway fetches content from IPFS gateway
func (s *StorageService) FetchFromGateway(cidStr string) (io.ReadCloser, string, error) {
	url := s.GetGatewayURL(cidStr)

	resp, err := s.client.Get(url)
	if err != nil {
		return nil, "", fmt.Errorf("failed to fetch from gateway: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, "", fmt.Errorf("gateway returned status %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	return resp.Body, contentType, nil
}

// UploadFromReader uploads content from a reader
func (s *StorageService) UploadFromReader(reader io.Reader, filename string, contentType string) (*UploadResult, error) {
	// Read all content
	buf := new(bytes.Buffer)
	_, err := io.Copy(buf, reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read content: %w", err)
	}

	return s.Upload(buf.Bytes(), filename, contentType)
}
