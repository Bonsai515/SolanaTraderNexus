import express from 'express';
import { ArbitrageOpportunity } from '../shared/signalTypes';
import { getAllDexes } from './dexInfo';

const router = express.Router();

router.get('/api/market/analyze/:token', async (req, res) => {
  try {
    const token = req.params.token;

    // Return basic market analysis
    res.json({
      token_info: {
        name: token.toUpperCase(),
        symbol: token.toUpperCase(),
        category: "token",
        blockchain: "Solana",
        contract_security: "verified",
      },
      market_position: {
        market_cap: "analyzing",
        rank: "analyzing",
        liquidity: "medium",
        trading_volume_trend: "stable"
      },
      risk_assessment: {
        overall_risk: "medium",
        specific_risks: ["market volatility", "liquidity risk"]
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/arbitrage/opportunities', async (req, res) => {
  try {
    const dexes = getAllDexes();
    const pairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];
    const opportunities: ArbitrageOpportunity[] = [];

    for (const pair of pairs) {
      const opportunity = {
        pair,
        dexA: dexes[0]?.name || 'Jupiter',
        dexB: dexes[1]?.name || 'Orca',
        priceA: 0,
        priceB: 0,
        profitPercent: 0,
        timestamp: new Date().toISOString()
      };
      opportunities.push(opportunity);
    }

    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;