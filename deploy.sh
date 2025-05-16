#!/bin/bash

echo "Starting lightweight deployment process for Solana Trading System..."

# Create directories
mkdir -p deploy
mkdir -p deploy/server
mkdir -p deploy/client
mkdir -p deploy/shared
mkdir -p deploy/logs

# Copy core server files
echo "Copying server files..."
cp -r server deploy/
cp -r shared deploy/

# Copy client static files
echo "Copying client files..."
cp -r client/public deploy/client/
cp index.html deploy/

# Copy configuration files
echo "Copying configuration files..."
cp package.json deploy/
cp Procfile deploy/
cp tsconfig.json deploy/

# Create run startup script
cat > deploy/start.sh << 'EOF'
#!/bin/bash
echo "Starting Solana Trading System..."
npx tsx server/index.ts
EOF

chmod +x deploy/start.sh

echo "✅ Deployment package created successfully!"
echo "To start the system: cd deploy && ./start.sh"