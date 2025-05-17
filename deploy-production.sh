
#!/bin/bash

echo "🚀 Starting deployment process..."

# Install dependencies including TypeScript
npm install
npm install -g typescript tsx

# Run TypeScript compilation
echo "Building TypeScript files..."
tsc --project tsconfig.json

# Start the server with TypeScript support
echo "Starting server with TypeScript..."
tsx server/index.ts
