package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Set Gin to release mode in production
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize configuration
	cfg := LoadConfig()

	// Initialize storage service
	storage, err := NewStorageService(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize storage service: %v", err)
	}

	// Initialize file repository (in-memory for demo, use database in production)
	fileRepo := NewFileRepository()

	// Initialize handlers
	handler := NewHandler(storage, fileRepo, cfg)

	// Setup Gin router
	r := gin.Default()

	// Trust only the proxy (Render uses reverse proxy)
	// Set to nil to not trust any proxy, or specific IPs for your proxy
	r.SetTrustedProxies(nil)

	// CORS configuration for React frontend
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "https://*dec-filesharer.vercel.app"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			// Allow localhost and vercel deployments
			return true
		},
		MaxAge: 12 * time.Hour,
	}))

	// API routes
	api := r.Group("/api")
	{
		// File upload and management
		api.POST("/upload", handler.Upload)
		api.POST("/register", handler.RegisterFile) // Register file with CID from frontend
		api.GET("/files", handler.ListFiles)
		api.GET("/files/:id", handler.GetFile)
		api.DELETE("/files/:id", handler.DeleteFile)

		// Share link management with UCAN delegations
		api.POST("/files/:id/share", handler.CreateShareLink)
		api.GET("/share/:token", handler.GetSharedFile)
		api.DELETE("/share/:token", handler.RevokeShareLink)

		// Delegation endpoint for client-side uploads
		api.GET("/delegation/:did", handler.CreateDelegation)

		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
	}

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
