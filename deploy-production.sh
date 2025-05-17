
#!/bin/bash

echo "🚀 Starting deployment process..."

# Install dependencies
npm install

# Run TypeScript compilation
echo "Building TypeScript files..."
npm run build

# Start the server
echo "Starting server..."
npm run start
