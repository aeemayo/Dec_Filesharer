package main

import (
	"log"
	"os"
	"time"
)

// Config holds application configuration
type Config struct {
	// Storacha/UCAN configuration
	PrivateKeyPath string
	ProofPath      string
	SpaceDID       string

	// Private key and proof contents (loaded from files)
	PrivateKey []byte
	Proof      []byte

	// Application settings
	DefaultExpiration time.Duration
	MaxFileSize       int64 // in bytes
	AllowedFileTypes  []string

	// IPFS Gateway
	IPFSGateway string
}

// LoadConfig loads configuration from environment variables and files
func LoadConfig() *Config {
	cfg := &Config{
		PrivateKeyPath:    getEnv("PRIVATE_KEY_PATH", "./private.key"),
		ProofPath:         getEnv("PROOF_PATH", "./proof.ucan"),
		SpaceDID:          getEnv("SPACE_DID", ""),
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

	// Load private key if file exists
	if _, err := os.Stat(cfg.PrivateKeyPath); err == nil {
		key, err := os.ReadFile(cfg.PrivateKeyPath)
		if err != nil {
			log.Printf("Warning: Could not read private key: %v", err)
		} else {
			cfg.PrivateKey = key
		}
	} else {
		log.Printf("Warning: Private key file not found at %s", cfg.PrivateKeyPath)
	}

	// Load proof if file exists
	if _, err := os.Stat(cfg.ProofPath); err == nil {
		proof, err := os.ReadFile(cfg.ProofPath)
		if err != nil {
			log.Printf("Warning: Could not read proof: %v", err)
		} else {
			cfg.Proof = proof
		}
	} else {
		log.Printf("Warning: Proof file not found at %s", cfg.ProofPath)
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
