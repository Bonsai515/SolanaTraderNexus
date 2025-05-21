/**
 * Memecoin Routes
 * 
 * Provides API endpoints for the global memecoin cache
 * with centralized token data and relationship tracking
 */

import { Router } from 'express';
import * as logger from '../logger';
import { memecoinCache, TokenRelationship } from '../lib/memecoinGlobalCache';
import { 
  initialize, 
  getAllTokens, 
  getSniperOpportunities,
  fetchPumpFunTokens, 
  fetchDexScreenerTokens, 
  fetchBirdeyeTokens 
} from '../lib/memeTokenConnector';

const router = Router();

// Initialize the connector on startup
initialize().catch(error => {
  logger.error(`Failed to initialize memecoin connector: ${error.message}`);
});

/**
 * GET /api/memecoins - Get all memecoins from the global cache
 */
router.get('/', async (req, res) => {
  try {
    // Optionally refresh data
    const refresh = req.query.refresh === 'true';
    
    let tokens: TokenRelationship[];
    
    if (refresh) {
      tokens = await getAllTokens();
    } else {
      tokens = memecoinCache.getAllTokens();
    }
    
    res.json({
      success: true,
      count: tokens.length,
      tokens: tokens
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch memecoin data',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/top - Get the top memecoins
 */
router.get('/top', async (req, res) => {
  try {
    // Optionally refresh data
    const refresh = req.query.refresh === 'true';
    
    if (refresh) {
      await getAllTokens();
      memecoinCache.updateTopTokens();
    }
    
    const tokens = memecoinCache.getTopTokens();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens: tokens
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/top: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top memecoins',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/new - Get newly launched memecoins
 */
router.get('/new', async (req, res) => {
  try {
    // Optionally refresh data
    const refresh = req.query.refresh === 'true';
    
    if (refresh) {
      await getAllTokens();
      memecoinCache.updateNewTokens();
    }
    
    const tokens = memecoinCache.getNewTokens();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens: tokens
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/new: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new memecoins',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/trending - Get trending memecoins
 */
router.get('/trending', async (req, res) => {
  try {
    // Optionally refresh data
    const refresh = req.query.refresh === 'true';
    
    if (refresh) {
      await getAllTokens();
      memecoinCache.updateTrendingTokens();
    }
    
    const tokens = memecoinCache.getTrendingTokens();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens: tokens
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/trending: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending memecoins',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/sniper - Get sniper opportunities
 */
router.get('/sniper', async (req, res) => {
  try {
    const tokens = await getSniperOpportunities();
    
    res.json({
      success: true,
      count: tokens.length,
      tokens: tokens
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/sniper: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sniper opportunities',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/search - Search for memecoins by name or symbol
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search query',
        message: 'Search query must be at least 2 characters long'
      });
    }
    
    const tokens = memecoinCache.searchTokens(query);
    
    res.json({
      success: true,
      count: tokens.length,
      query: query,
      tokens: tokens
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/search: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to search memecoins',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/token/:address - Get a specific token by address
 */
router.get('/token/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const token = memecoinCache.getToken(address);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        message: `No token found with address ${address}`
      });
    }
    
    res.json({
      success: true,
      token: token
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/token/:address: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/by-symbol/:symbol - Get a specific token by symbol
 */
router.get('/by-symbol/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const token = memecoinCache.getTokenBySymbol(symbol);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        message: `No token found with symbol ${symbol}`
      });
    }
    
    res.json({
      success: true,
      token: token
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/by-symbol/:symbol: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token',
      message: error.message
    });
  }
});

/**
 * GET /api/memecoins/stats - Get cache statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = memecoinCache.getStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    logger.error(`Error in GET /api/memecoins/stats: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/memecoins/refresh - Force refresh all data
 */
router.post('/refresh', async (req, res) => {
  try {
    logger.info('Manually refreshing memecoin data');
    
    // Run all data fetching in parallel
    const [pumpFunTokens, dexScreenerTokens, birdeyeTokens] = await Promise.all([
      fetchPumpFunTokens().catch(() => []), 
      fetchDexScreenerTokens().catch(() => []),
      fetchBirdeyeTokens().catch(() => [])
    ]);
    
    // Update the organized lists
    memecoinCache.updateTopTokens();
    memecoinCache.updateNewTokens();
    memecoinCache.updateTrendingTokens();
    
    res.json({
      success: true,
      message: 'Successfully refreshed memecoin data',
      counts: {
        pumpFun: pumpFunTokens.length,
        dexScreener: dexScreenerTokens.length,
        birdeye: birdeyeTokens.length,
        totalTokens: memecoinCache.getAllTokens().length
      }
    });
  } catch (error) {
    logger.error(`Error in POST /api/memecoins/refresh: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh memecoin data',
      message: error.message
    });
  }
});

export default router;