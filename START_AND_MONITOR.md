# Hyperion Trading System: How to Start and Monitor

## Starting the System

1. **Start the entire system with one command:**
   ```bash
   npm run dev
   ```
   This will start the Nexus engine, initialize all transformers, and activate all trading agents.

2. **Alternatively, start with specific components:**
   ```bash
   # Start just the server with transaction engine
   node server/index.ts
   
   # Start with dashboard monitoring
   npm run dashboard
   
   # Start with live trading enabled
   npm run live-trading
   ```

3. **Monitor system startup:**
   Look for these success messages:
   - ✅ Successfully connected to Solana blockchain
   - ✅ Successfully initialized Nexus Professional Engine
   - ✅ Successfully initialized all transformers
   - ✅ Successfully initialized all AI trading agents

## Monitoring Performance

### Command Line Monitoring

1. **View active trades:**
   ```bash
   node scripts/view-active-trades.js
   ```

2. **Check wallet balances:**
   ```bash
   node scripts/check-wallet-balance.js
   ```

3. **View profit summary:**
   ```bash
   node scripts/view-profit-summary.js
   ```

4. **Check system status:**
   ```bash
   curl http://localhost:5000/api/status
   ```

### Web Dashboard

1. **Access the dashboard:**
   Open your browser to `http://localhost:5000`

2. **Real-time monitoring tabs:**
   - Active Trades
   - Profit Tracking
   - Agent Performance
   - System Health

3. **Configure alerts:**
   Set up notifications for large trades, errors, or profit milestones in the dashboard settings.

## Adjusting Strategies

1. **Modify strategy parameters:**
   Edit configuration files in `server/config/` directory.

2. **Update strategy weights:**
   ```bash
   curl -X POST http://localhost:5000/api/strategies/weights \
   -H "Content-Type: application/json" \
   -d '{"hyperion": 0.4, "quantum": 0.3, "singularity": 0.3}'
   ```

3. **Enable/disable specific strategies:**
   ```bash
   # Enable grid trading
   curl -X POST http://localhost:5000/api/strategies/grid/enable
   
   # Disable launch detection
   curl -X POST http://localhost:5000/api/strategies/launch-detection/disable
   ```

## Troubleshooting

1. **If transactions are failing:**
   - Check Solana RPC connection status
   - Verify wallet has sufficient SOL for transaction fees
   - Check priority fee settings

2. **If opportunities aren't being found:**
   - Verify price feed connections
   - Check rate limits on external APIs
   - Restart neural price feed module

3. **If profit capture isn't working:**
   - Verify system wallet connection
   - Check profit transfer logs
   - Ensure wallet has permissions for transfers

## System Maintenance

1. **Regular backups:**
   ```bash
   # Backup profit data
   cp -r ./data/profits ./backups/profits_$(date +%Y%m%d)
   ```

2. **Update transformers:**
   ```bash
   npm run update-transformers
   ```

3. **Clean logs:**
   ```bash
   npm run clean-logs
   ```

## Security Recommendations

1. **Store wallet keys securely** in environment variables, never in code
2. **Use separate wallets** for different strategies to limit risk
3. **Set profit withdrawal schedule** to regularly secure gains
4. **Monitor transaction logs** for unusual activity
5. **Set maximum trade sizes** to limit potential losses

## Quick Commands Reference

```bash
# Start all systems
npm run dev

# View active trades
node scripts/view-active-trades.js

# Check profit summary
node scripts/view-profit-summary.js

# Stop all trading (emergency)
node scripts/stop-trading.js

# Restart transformers
node scripts/restart-transformers.js

# Test Solana connection
node scripts/test-solana-connection.js
```