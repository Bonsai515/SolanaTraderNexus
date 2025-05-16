#!/bin/bash

echo "🚀 Creating production deployment package for Quantum Hyperion Trading System..."

# Create clean directories
rm -rf production
mkdir -p production
mkdir -p production/server
mkdir -p production/client
mkdir -p production/shared
mkdir -p production/logs

# Copy core server files
echo "⚡ Copying optimized server files..."
cp -r server production/
cp -r shared production/

# Copy client static files
echo "📊 Copying dashboard files..."
cp -r client/public production/client/
cp index.html production/

# Copy configuration files
echo "⚙️ Copying configuration files..."
cp package.json production/
cp tsconfig.json production/

# Create optimized Procfile for deployment
cat > production/Procfile << 'EOF'
web: npx tsx server/index.ts
EOF

# Create specialized README
cat > production/README.md << 'EOF'
# Quantum Hyperion Trading System

A cutting-edge Solana trading platform leveraging advanced blockchain technologies for intelligent financial routing and user-centric trading experiences.

## Deployment Requirements

The following environment variables must be set:
- `SOLANA_RPC_API_KEY` - Your Solana RPC API key
- `INSTANT_NODES_RPC_URL` - Your Instant Nodes RPC URL
- `HELIUS_API_KEY` - Your Helius API key
- `ALCHEMY_RPC_URL` - Your Alchemy RPC URL
- `PERPLEXITY_API_KEY` - Your Perplexity API key
- `WORMHOLE_API_KEY` - Your Wormhole API key

## Features

- Rust and TypeScript-based backend architecture
- Solana blockchain integration with multi-wallet system
- Advanced wallet routing and real-time profit collection strategies
- Cross-source price aggregation with intelligent signal processing
- Secure wallet management with sophisticated private key protocols
- Automated trading strategies including complex transaction optimization

## Components

- **Hyperion Flash Arbitrage Overlord**: Cross-DEX flash loan arbitrage
- **Quantum Omega Sniper**: Specialized meme coin sniper
- **Singularity Cross-Chain Oracle**: Multi-chain optimization strategies
- **MemeCortex Transformer**: Meme coin sentiment and market prediction
- **Security Transformer**: Risk assessment and token validation

## Neural-Quantum Entanglement

The system features specialized neural-quantum entanglement between transformers and agents.
EOF

# Create .gitignore file
cat > production/.gitignore << 'EOF'
node_modules/
.env
logs/
*.log
dist/
EOF

# Create start script
cat > production/start.sh << 'EOF'
#!/bin/bash
echo "Starting Quantum Hyperion Trading System..."
npx tsx server/index.ts
EOF

chmod +x production/start.sh

echo "✅ Production package created successfully in ./production directory"
echo "You can now deploy this package to any hosting provider."
echo "To start locally: cd production && ./start.sh"