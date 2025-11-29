package main

import (
	"os"
	"time"
)

// Config holds application configuration
type Config struct {
	// Storacha/UCAN configuration - values directly from env vars
	PrivateKey string
	Proof      string
	SpaceDID   string

	// Application settings
	DefaultExpiration time.Duration
	MaxFileSize       int64 // in bytes
	AllowedFileTypes  []string

	// IPFS Gateway
	IPFSGateway string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	cfg := &Config{
		PrivateKey:        getEnv("STORACHA_PRIVATE_KEY", ""),
		Proof:             getEnv("STORACHA_PROOF", ""),
		SpaceDID:          getEnv("STORACHA_SPACE_DID", ""),
		DefaultExpiration: 24 * time.Hour,
		MaxFileSize:       100 * 1024 * 1024, // 100MB default
		AllowedFileTypes: []string{
			"image/jpeg", "image/png", "image/gif", "image/webp",
			"application/pdf",
			"text/plain",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		},
		IPFSGateway: getEnv("IPFS_GATEWAY", "https://w3s.link/ipfs"),
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
