# Dec FileSharer

A decentralized file sharing web application built with Go (Gin) and React. Upload and share files via unique links with UCAN-based expiration and revocation, powered by Storacha Network and IPFS.

## Features

- **Drag & Drop Uploads**: Easy file uploads with react-dropzone
- **Decentralized Storage**: Files stored on IPFS via Storacha Network
- **UCAN Authorization**: Secure, capability-based access control
- **Expirable Share Links**: Create links that automatically expire
- **Link Revocation**: Revoke access anytime with UCAN revocations
- **Access Limits**: Set maximum number of accesses per link
- **IPFS Gateway Preview**: View files directly from IPFS gateways


## Prerequisites

- **Go**: 1.21 or higher
- **Node.js**: 22 or higher (with npm 7+)
- **Storacha CLI**: For generating DID and proofs

## Quick Start

### 1. Install Storacha CLI

```bash
npm install -g @storacha/cli
```

### 2. Generate DID and Create Space

```bash
# Generate a DID key
storacha key create
# Output: did:key:z6Mk... and private key (save the private key!)

# Save the private key to a file
echo "MgCb+bRG..." > private.key

# Login to Storacha
storacha login your-email@example.com

# Create a space
storacha space create my-fileshare-space

# Delegate capabilities to your DID
storacha delegation create \
  -c 'space/blob/add' \
  -c 'space/index/add' \
  -c 'upload/add' \
  -c 'filecoin/offer' \
  did:key:... -o proof.ucan
```

### 3. Configure Backend

Create a `.env` file or set environment variables:

```bash
# Required
PRIVATE_KEY_PATH=./private.key
PROOF_PATH=./proof.ucan
SPACE_DID=did:key:  # Your space DID

# Optional
PORT=8080
IPFS_GATEWAY=https://w3s.link/ipfs
```

### 4. Start the Backend

```bash
# Install dependencies
go mod tidy

# Run the server
go run .
```


### 5. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```


## Production Deployment

### Backend

1. Build the Go binary:
   ```bash
   go build -o dec-filesharer .
   ```

2. Set environment variables for production
3. Use a reverse proxy (nginx) for HTTPS
4. Consider using a database instead of in-memory storage

### Frontend

1. Build for production:
   ```bash
   cd frontend
   npm run build
   ```

2. Deploy the `dist` folder to your static hosting

## Security Considerations

- **Private Keys**: Never commit `private.key` to version control
- **HTTPS**: Always use HTTPS in production
- **CORS**: Update `AllowOrigins` in `main.go` for production domains
- **Rate Limiting**: Consider adding rate limiting for production
- **Database**: Use a proper database for file metadata in production

## Resources

- [Storacha Documentation](https://docs.storacha.network/)
- [UCAN Specification](https://ucan.xyz/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [Gin Web Framework](https://gin-gonic.com/)
- [Guppy Go Client](https://github.com/storacha/guppy)

