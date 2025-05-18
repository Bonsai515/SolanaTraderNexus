# Real On-Chain Trading Setup

## Prerequisites

Before running real on-chain trading, you will need:

1. A Solana wallet with sufficient SOL for transactions
2. RPC endpoints with good performance and high rate limits
3. API keys for price feeds
4. Understanding of the risks involved in automated trading

## Setup Steps

1. Edit the `.env.trading` file and fill in all required information:
   - Solana RPC URLs
   - Wallet information
   - API keys

2. Load environment variables:
   ```
   source .env.trading
   ```

3. Launch real trading:
   ```
   ./launch-real-trading.sh
   ```

4. Monitor trading activity:
   ```
   npx tsx real-trading-monitor.ts
   ```

## Security Considerations

- **NEVER** share your private keys
- **NEVER** commit .env files with private keys to repositories
- Consider using a dedicated trading wallet with limited funds
- Start with small amounts until you've verified the system works correctly

## Risk Management

The system includes risk management features:

- Daily loss limits
- Maximum position sizes
- Minimum wallet balance requirements
- Transaction simulation before submission

Adjust these settings in `config/arbitrage-config.json` based on your risk tolerance.

## Troubleshooting

If you encounter issues:

1. Check RPC connection and rate limits
2. Verify wallet has sufficient SOL for transactions
3. Check API key validity
4. Review logs for specific error messages
