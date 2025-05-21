/**
 * Sniper Routes
 * 
 * Provides API endpoints for meme token scanning and sniper opportunities
 */

import { Router } from 'express';
import * as logger from '../logger';
import {
  scanForTokens,
  findSniperOpportunities,
  findNewTokenLaunches,
  findHighLiquidityTokens,
  findMomentumTokens,
  ScanOptions,
  MemeToken
} from '../lib/memeTokenScanner';

const router = Router();

// Get scanning options from request query
function getScanOptionsFromQuery(query: any): ScanOptions {
  return {
    minPriceChangePercent: query.minPriceChange ? parseFloat(query.minPriceChange) : undefined,
    maxAge: query.maxAge ? parseFloat(query.maxAge) : undefined,
    minLiquidity: query.minLiquidity ? parseFloat(query.minLiquidity) : undefined,
    minVolume: query.minVolume ? parseFloat(query.minVolume) : undefined,
    limit: query.limit ? parseInt(query.limit) : undefined,
    onlyNew: query.onlyNew === 'true',
    sortBy: query.sortBy as any,
    sortDirection: query.sortDirection as any,
    excludeTokens: query.excludeTokens ? query.excludeTokens.split(',') : undefined
  };
}

// GET /api/sniper/tokens - Get all tokens with custom filters
router.get('/tokens', async (req, res) => {
  try {
    const options = getScanOptionsFromQuery(req.query);
    const tokens = await scanForTokens(options);
    
    res.json({
      success: true,
      count: tokens.length,
      tokens
    });
  } catch (error) {
    logger.error(`Error in /api/sniper/tokens: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for tokens',
      message: error.message
    });
  }
});

// GET /api/sniper/opportunities - Get potential sniper opportunities
router.get('/opportunities', async (req, res) => {
  try {
    const tokens = await findSniperOpportunities();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens
    });
  } catch (error) {
    logger.error(`Error in /api/sniper/opportunities: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to find sniper opportunities',
      message: error.message
    });
  }
});

// GET /api/sniper/new-launches - Get new token launches
router.get('/new-launches', async (req, res) => {
  try {
    const tokens = await findNewTokenLaunches();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens
    });
  } catch (error) {
    logger.error(`Error in /api/sniper/new-launches: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to find new token launches',
      message: error.message
    });
  }
});

// GET /api/sniper/high-liquidity - Get high liquidity tokens
router.get('/high-liquidity', async (req, res) => {
  try {
    const tokens = await findHighLiquidityTokens();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens
    });
  } catch (error) {
    logger.error(`Error in /api/sniper/high-liquidity: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to find high liquidity tokens',
      message: error.message
    });
  }
});

// GET /api/sniper/momentum - Get tokens with price momentum
router.get('/momentum', async (req, res) => {
  try {
    const tokens = await findMomentumTokens();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens
    });
  } catch (error) {
    logger.error(`Error in /api/sniper/momentum: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to find momentum tokens',
      message: error.message
    });
  }
});

export default router;