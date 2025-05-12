# Hyperion Trading System CLI Dashboard

This dashboard provides real-time monitoring of your Hyperion trading system's performance, wallet balances, active trading strategies, and more - all from the command line.

## Features

* Real-time monitoring of trading agents (Hyperion, Quantum Omega, Singularity)
* System wallet balance tracking
* Live price feeds for trading pairs
* Trading signal monitoring
* Transaction history and performance metrics
* WebSocket-based for instant updates

## Dashboard Options

Two versions of the dashboard are available:

### TypeScript Version (Full-featured)

The TypeScript dashboard offers comprehensive monitoring with detailed metrics and enhanced visualization. Best for local development and systems with TypeScript support.

To start:

```bash
# Make the script executable (first time only)
chmod +x dashboard.sh

# Run the dashboard
./dashboard.sh
```

### JavaScript Version (Simple)

The JavaScript dashboard is a lightweight alternative that works on any system with Node.js. It provides all essential monitoring features without TypeScript dependencies.

To start:

```bash
# Make the script executable (first time only)
chmod +x simple-dashboard.sh

# Run the dashboard
./simple-dashboard.sh
```

## Requirements

- **TypeScript Dashboard**: Requires Node.js, TypeScript, and ts-node
- **Simple Dashboard**: Requires only Node.js

## Dashboard Components

The dashboard displays the following sections:

1. **System Status**: 
   - API connectivity 
   - Solana RPC connection
   - Wormhole bridge status
   - API connection status

2. **System Wallet**:
   - Wallet address
   - Current balance
   - Last balance update time

3. **Active Agents**:
   - List of trading agents
   - Current status (scanning, executing, idle)
   - Profit metrics and execution counts

4. **Market Prices**:
   - Current prices for trading pairs
   - 24h volume
   - Price change percentages

5. **Active Signals**:
   - Current trading signals
   - Signal types and strengths
   - Trading directions

6. **Recent Transactions**:
   - Latest trading executions
   - Profit/loss per transaction
   - Transaction signatures

7. **Performance Summary**:
   - Total executions
   - Success rate
   - Profit metrics

8. **System Logs**:
   - Recent activity logs
   - Error messages
   - Status updates

## Customization

You can customize the dashboard by editing the CONFIG object in either:

- `system-dashboard.ts` (TypeScript version)
- `simple-dashboard.js` (JavaScript version)

Key configuration options:

- `apiEndpoint`: The base URL of your trading system API
- `refreshInterval`: How frequently data refreshes (in milliseconds)
- `systemWalletAddress`: Your system wallet address

## Troubleshooting

If the dashboard fails to connect:

1. Ensure the trading system server is running
2. Check that the API endpoint in CONFIG is correct
3. Verify your network connection
4. Check for any firewall or access restrictions

## Logs

Dashboard logs are stored in:

- `./logs/trading-dashboard.log` (TypeScript version)
- `./logs/simple-dashboard.log` (JavaScript version)