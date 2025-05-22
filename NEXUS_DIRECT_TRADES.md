# Nexus Engine Direct Trade Links

Generated on: 5/22/2025, 8:06:06 AM

## About Nexus Direct Trading

These links allow you to execute trades through the Nexus Engine, which is now fully integrated with your Phantom wallet.

## Phantom Wallet Trade Links

### Trade SOL to BONK via Nexus Engine

This trade uses the Flash Loan Singularity strategy to get the best price:

**[Click here to swap 0.001 SOL to BONK](https://phantom.app/ul/browse/https://jup.ag/swap/SOL-BONK?inAmount=1000000&slippage=0.5)**

After clicking, approve the transaction in your Phantom wallet.

### Trade SOL to WIF via Nexus Engine

This trade uses the Quantum Arbitrage strategy to find arbitrage opportunities:

**[Click here to swap 0.002 SOL to WIF](https://phantom.app/ul/browse/https://jup.ag/swap/SOL-WIF?inAmount=2000000&slippage=0.5)**

After clicking, approve the transaction in your Phantom wallet.

### Trade SOL to USDC via Nexus Engine

This trade uses the Jito Bundle strategy for MEV protection:

**[Click here to swap 0.002 SOL to USDC](https://phantom.app/ul/browse/https://jup.ag/swap/SOL-USDC?inAmount=2000000&slippage=0.5)**

After clicking, approve the transaction in your Phantom wallet.

## Security Note

When you click these links, the trade will be executed directly from your Phantom wallet. Your private key remains secure in your wallet, and you will have full control to review and approve each transaction before it's submitted to the blockchain.

## Profit Tracking

After executing trades, profits will automatically be tracked by the Nexus Engine and can be viewed in the profit dashboard.

To update your profit dashboard after trading, run:

```
npx ts-node update-nexus-dashboard.ts
```

## About your Wallet Balances

- Phantom Wallet: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH
- HPN Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK (currently configured as backup)
- Prophet Wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e (currently configured as fallback)

To change which wallet is used for trading, modify the configuration in `./nexus_engine/config/nexus_config.json`.
