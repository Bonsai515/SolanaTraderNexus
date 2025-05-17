
#!/bin/bash

echo "🚀 Starting deployment process..."

# Install dependencies
npm install

# Build with TypeScript
echo "Building TypeScript files..."
npm run build

# Start the production server
echo "Starting production server..."
node dist/server/index.js
