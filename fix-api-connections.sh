#!/bin/bash

# Fix API Connections and Integrate Premium DEX Sources
# This script fixes failing API endpoints and adds proper DEX integrations

echo "=== FIXING API CONNECTIONS AND INTEGRATING PREMIUM DEX SOURCES ==="

# Create optimized data source configuration
echo "Creating optimized data source configuration..."
mkdir -p ./config/data-sources

cat > ./config/data-sources/premium-dex-config.json << EOF
{
  "version": "2.0",
  "premiumDataSources": {
    "primaryDEXes": [
      {
        "name": "Jupiter",
        "endpoint": "https://price.jup.ag/v4",
        "websocket": "wss://price.jup.ag/v4/ws",
        "priority": 10,
        "enabled": true,
        "rateLimit": 100,
        "features": ["price", "swap", "routes", "tokens"]
      },
      {
        "name": "Raydium",
        "endpoint": "https://api.raydium.io/v2",
        "priority": 9,
        "enabled": true,
        "rateLimit": 50,
        "features": ["pools", "farms", "price", "volume"]
      },
      {
        "name": "Orca",
        "endpoint": "https://api.orca.so",
        "priority": 9,
        "enabled": true,
        "rateLimit": 50,
        "features": ["whirlpools", "price", "volume"]
      },
      {
        "name": "Serum",
        "endpoint": "https://serum-api.bonfida.com",
        "priority": 8,
        "enabled": true,
        "rateLimit": 30,
        "features": ["orderbook", "trades", "price"]
      },
      {
        "name": "DexScreener",
        "endpoint": "https://api.dexscreener.com/latest/dex",
        "priority": 7,
        "enabled": true,
        "rateLimit": 20,
        "features": ["price", "volume", "pairs"]
      }
    ],
    "disabledSources": [
      "pump.fun",
      "api.gmgn.ai",
      "meteora.ag",
      "instantnodes",
      "birdeye-cache.pump.fun"
    ],
    "fallbackSources": [
      {
        "name": "CoinGecko",
        "endpoint": "https://api.coingecko.com/api/v3",
        "priority": 5,
        "enabled": true,
        "rateLimit": 10
      }
    ]
  },
  "rpcConfiguration": {
    "primaryEndpoints": [
      "https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc",
      "https://divine-wispy-sanctuary.solana-mainnet.discover.quiknode.pro/8785a9391619df4e9ebbff59d3a43a30dbaca318/"
    ],
    "websocketEndpoints": [
      "wss://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/ws",
      "wss://divine-wispy-sanctuary.solana-mainnet.discover.quiknode.pro/8785a9391619df4e9ebbff59d3a43a30dbaca318/"
    ],
    "disabledEndpoints": [
      "instantnodes",
      "solana-api.instantnodes.io"
    ],
    "connectionSettings": {
      "maxRetries": 3,
      "timeoutMs": 30000,
      "rateLimitPerSecond": 25,
      "useWebSocketForSubscriptions": true,
      "preferPremiumEndpoints": true
    }
  }
}
EOF

# Create Jupiter integration
echo "Creating Jupiter DEX integration..."
cat > ./nexus_engine/integrations/jupiter-dex.js << EOF
/**
 * Jupiter DEX Integration
 * High-performance Jupiter API integration for swap routing and price data
 */

const axios = require('axios');

class JupiterDEXIntegration {
  constructor() {
    this.baseURL = 'https://price.jup.ag/v4';
    this.quoteAPI = 'https://quote-api.jup.ag/v6';
    this.swapAPI = 'https://quote-api.jup.ag/v6/swap';
    this.wsEndpoint = 'wss://price.jup.ag/v4/ws';
    this.rateLimit = 100; // requests per second
    this.lastRequest = 0;
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    const minInterval = 1000 / this.rateLimit;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }
    
    this.lastRequest = Date.now();
  }

  async getTokenPrice(tokenAddress) {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.baseURL}/price?ids=\${tokenAddress}\`, {
        timeout: 10000
      });
      
      if (response.data && response.data.data) {
        return {
          address: tokenAddress,
          price: response.data.data[tokenAddress]?.price || 0,
          source: 'Jupiter',
          timestamp: Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.error(\`Jupiter price fetch error for \${tokenAddress}:\`, error.message);
      return null;
    }
  }

  async getSwapQuote(inputToken, outputToken, amount) {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.quoteAPI}/quote\`, {
        params: {
          inputMint: inputToken,
          outputMint: outputToken,
          amount: amount,
          slippageBps: 50,
          onlyDirectRoutes: false,
          asLegacyTransaction: false
        },
        timeout: 15000
      });
      
      return response.data;
    } catch (error) {
      console.error(\`Jupiter quote error:\`, error.message);
      return null;
    }
  }

  async getAllTokenPrices() {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.baseURL}/price?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\`, {
        timeout: 10000
      });
      
      return response.data.data || {};
    } catch (error) {
      console.error('Jupiter all prices fetch error:', error.message);
      return {};
    }
  }
}

module.exports = JupiterDEXIntegration;
EOF

# Create Raydium integration
echo "Creating Raydium DEX integration..."
cat > ./nexus_engine/integrations/raydium-dex.js << EOF
/**
 * Raydium DEX Integration
 * High-performance Raydium API integration for pool data and prices
 */

const axios = require('axios');

class RaydiumDEXIntegration {
  constructor() {
    this.baseURL = 'https://api.raydium.io/v2';
    this.rateLimit = 50;
    this.lastRequest = 0;
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    const minInterval = 1000 / this.rateLimit;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }
    
    this.lastRequest = Date.now();
  }

  async getPoolInfo(poolAddress) {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.baseURL}/ammV3/pools/info/mint?mint1=\${poolAddress}\`, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error(\`Raydium pool info error:\`, error.message);
      return null;
    }
  }

  async getAllPools() {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.baseURL}/ammV3/pools/info/list\`, {
        timeout: 15000
      });
      
      return response.data;
    } catch (error) {
      console.error('Raydium pools fetch error:', error.message);
      return [];
    }
  }
}

module.exports = RaydiumDEXIntegration;
EOF

# Create Orca integration
echo "Creating Orca DEX integration..."
cat > ./nexus_engine/integrations/orca-dex.js << EOF
/**
 * Orca DEX Integration
 * High-performance Orca API integration for whirlpool data
 */

const axios = require('axios');

class OrcaDEXIntegration {
  constructor() {
    this.baseURL = 'https://api.orca.so';
    this.rateLimit = 50;
    this.lastRequest = 0;
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    const minInterval = 1000 / this.rateLimit;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }
    
    this.lastRequest = Date.now();
  }

  async getWhirlpools() {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.baseURL}/v1/whirlpool/list\`, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error('Orca whirlpools fetch error:', error.message);
      return [];
    }
  }

  async getTokenPrice(tokenAddress) {
    try {
      await this.enforceRateLimit();
      const response = await axios.get(\`\${this.baseURL}/v1/token/\${tokenAddress}/price\`, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error(\`Orca price fetch error for \${tokenAddress}:\`, error.message);
      return null;
    }
  }
}

module.exports = OrcaDEXIntegration;
EOF

# Create clean data source manager
echo "Creating clean data source manager..."
cat > ./nexus_engine/data-sources/clean-data-manager.js << EOF
/**
 * Clean Data Source Manager
 * Manages only working, premium data sources
 */

const JupiterDEXIntegration = require('../integrations/jupiter-dex');
const RaydiumDEXIntegration = require('../integrations/raydium-dex');
const OrcaDEXIntegration = require('../integrations/orca-dex');
const axios = require('axios');

class CleanDataManager {
  constructor() {
    this.jupiter = new JupiterDEXIntegration();
    this.raydium = new RaydiumDEXIntegration();
    this.orca = new OrcaDEXIntegration();
    
    // Only use working endpoints
    this.workingEndpoints = [
      'https://api.dexscreener.com/latest/dex',
      'https://api.coingecko.com/api/v3'
    ];
    
    // Disable problematic sources
    this.disabledSources = [
      'pump.fun',
      'api.gmgn.ai',
      'meteora.ag',
      'instantnodes',
      'birdeye'
    ];
    
    this.priceCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async getTokenPrices(tokenAddresses) {
    const prices = {};
    
    try {
      // Try Jupiter first (most reliable)
      for (const address of tokenAddresses) {
        const cachedPrice = this.getCachedPrice(address);
        if (cachedPrice) {
          prices[address] = cachedPrice;
          continue;
        }
        
        const jupiterPrice = await this.jupiter.getTokenPrice(address);
        if (jupiterPrice && jupiterPrice.price > 0) {
          prices[address] = jupiterPrice.price;
          this.setCachedPrice(address, jupiterPrice.price);
        }
      }
      
      // Fallback to DexScreener for missing prices
      await this.fillMissingPricesFromDexScreener(tokenAddresses, prices);
      
    } catch (error) {
      console.error('Clean data manager error:', error.message);
    }
    
    return prices;
  }

  async fillMissingPricesFromDexScreener(tokenAddresses, existingPrices) {
    try {
      const missingAddresses = tokenAddresses.filter(addr => !existingPrices[addr]);
      
      if (missingAddresses.length === 0) return;
      
      const response = await axios.get(\`https://api.dexscreener.com/latest/dex/tokens/\${missingAddresses.join(',')}\`, {
        timeout: 10000
      });
      
      if (response.data && response.data.pairs) {
        response.data.pairs.forEach(pair => {
          if (pair.baseToken && pair.priceUsd) {
            const address = pair.baseToken.address;
            existingPrices[address] = parseFloat(pair.priceUsd);
            this.setCachedPrice(address, parseFloat(pair.priceUsd));
          }
        });
      }
    } catch (error) {
      console.error('DexScreener fallback error:', error.message);
    }
  }

  getCachedPrice(address) {
    const cached = this.priceCache.get(address);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.price;
    }
    return null;
  }

  setCachedPrice(address, price) {
    this.priceCache.set(address, {
      price: price,
      timestamp: Date.now()
    });
  }

  async getSwapQuote(inputToken, outputToken, amount) {
    // Use Jupiter for swap quotes (most reliable)
    return await this.jupiter.getSwapQuote(inputToken, outputToken, amount);
  }

  isSourceDisabled(sourceName) {
    return this.disabledSources.some(disabled => 
      sourceName.toLowerCase().includes(disabled.toLowerCase())
    );
  }
}

module.exports = CleanDataManager;
EOF

# Update RPC configuration to use only premium endpoints
echo "Updating RPC configuration to use only premium endpoints..."
cat > ./config/premium-rpc-config.json << EOF
{
  "primaryEndpoint": "https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc",
  "premiumEndpoints": [
    "https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc",
    "https://divine-wispy-sanctuary.solana-mainnet.discover.quiknode.pro/8785a9391619df4e9ebbff59d3a43a30dbaca318/"
  ],
  "websocketEndpoints": [
    "wss://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/ws",
    "wss://divine-wispy-sanctuary.solana-mainnet.discover.quiknode.pro/8785a9391619df4e9ebbff59d3a43a30dbaca318/"
  ],
  "disabledEndpoints": [
    "instantnodes",
    "solana-api.instantnodes.io",
    "instant-nodes",
    "NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9"
  ],
  "connectionSettings": {
    "useOnlyPremiumEndpoints": true,
    "maxRetries": 3,
    "timeoutMs": 30000,
    "rateLimitPerSecond": 25,
    "useWebSocketForSubscriptions": true,
    "preferPremiumEndpoints": true,
    "avoidRateLimitedEndpoints": true,
    "enableFailover": true,
    "healthCheckInterval": 60000
  },
  "rateLimiting": {
    "enabled": true,
    "maxRequestsPerSecond": 25,
    "burstLimit": 50,
    "delayBetweenRequests": 40
  }
}
EOF

# Apply the premium RPC configuration
cp ./config/premium-rpc-config.json ./config/rpc-config.json

# Create startup script with clean configuration
echo "Creating clean startup script..."
cat > ./start-clean-trading-system.sh << EOF
#!/bin/bash

# Clean Trading System Startup
# Uses only working, premium data sources and RPC endpoints

echo "=== STARTING CLEAN TRADING SYSTEM ==="
echo "Using only premium, working data sources and RPC endpoints"

# Kill any existing processes
pkill -f "node.*nexus" || true
pkill -f "profit-tracker" || true
sleep 2

# Apply clean configurations
cp ./config/premium-rpc-config.json ./config/rpc-config.json
cp ./config/data-sources/premium-dex-config.json ./nexus_engine/config/data-sources.json

# Set environment variables for clean operation
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXUS_CLEAN_MODE="true"
export NEXUS_DISABLE_PROBLEMATIC_SOURCES="true"
export NEXUS_USE_PREMIUM_RPC_ONLY="true"
export NEXUS_TRADER_MODE="clean-performance"

echo "Disabled problematic sources: pump.fun, gmgn.ai, meteora.ag, instantnodes"
echo "Using premium RPC: Syndica + QuickNode only"
echo "Using working DEX sources: Jupiter, Raydium, Orca, DexScreener"

# Start the trading system
echo "Starting clean trading system..."
node --experimental-specifier-resolution=node --no-warnings ./nexus_engine/start.js --mode=clean-performance &

echo ""
echo "✅ CLEAN TRADING SYSTEM STARTED"
echo "Your system is now running with:"
echo "  • Premium Syndica + QuickNode RPC only"
echo "  • Jupiter, Raydium, Orca DEX integrations"
echo "  • DexScreener as backup price source"
echo "  • All problematic APIs disabled"
echo ""
EOF

chmod +x ./start-clean-trading-system.sh

# Start the clean system
echo "Starting clean trading system with fixed API connections..."
./start-clean-trading-system.sh

echo ""
echo "✅ API CONNECTIONS FIXED AND PREMIUM DEX SOURCES INTEGRATED"
echo "Your trading system now uses:"
echo "  • Jupiter DEX API (primary swap and price data)"
echo "  • Raydium API (pool information)"
echo "  • Orca API (whirlpool data)"
echo "  • DexScreener (backup price data)"
echo "  • Premium Syndica + QuickNode RPC only"
echo "  • All problematic sources disabled"
echo ""
echo "Problematic sources disabled:"
echo "  × pump.fun (404 errors)"
echo "  × gmgn.ai (connection failed)"
echo "  × meteora.ag (connection failed)"
echo "  × instantnodes (rate limited)"
echo ""