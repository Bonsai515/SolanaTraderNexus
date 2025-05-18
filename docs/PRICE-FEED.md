# Enhanced Price Feed System

## Overview
The Enhanced Price Feed System provides reliable, fast, and accurate price data for all trading strategies. It's designed to avoid rate limits by using multiple price sources with smart caching.

## Key Features
- **Multiple Price Sources**: Jupiter, Birdeye, Pyth, and Helius DEX pools
- **Smart Caching**: 5-second TTL cache to stay under API rate limits
- **Advanced Monitoring**: Track success rates, latency, and other key metrics
- **Dashboard**: Visual interface for monitoring price data quality

## Available Endpoints
- GET /api/tokens - List all supported tokens
- GET /api/price/:token - Get price for a specific token
- POST /api/prices - Get multiple token prices
- GET /api/metrics/sources - Source metrics
- GET /api/metrics/prices - Price metrics history
- GET /api/dashboard - Dashboard data
- GET /health - Health check endpoint

## Integration with Trading Strategies
All trading strategies now use this enhanced price feed system:
- Quantum Flash Loan strategy
- Quantum Omega Meme Token strategy
- Zero Capital Flash Loan strategy
- Hyperion Neural Flash strategy

## Monitoring
The system provides detailed monitoring:
- Source success rates and latency
- Cache hit/miss rates
- Price update history
- System resource usage

## Dashboard
Access the dashboard at: http://localhost:3030/
