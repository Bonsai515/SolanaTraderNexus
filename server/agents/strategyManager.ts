import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { Strategy } from '@shared/schema';

/**
 * Sets up routes for managing trading strategies
 */
export function setupStrategyRoutes() {
  const router = Router();

  // Get all strategies
  router.get('/', async (req, res) => {
    try {
      // In a real app, we would get strategies for the authenticated user
      const userId = 1; // Assuming user ID 1
      const strategies = await storage.getStrategiesByUserId(userId);
      
      // Format strategies for frontend
      const formattedStrategies = strategies.map(strategy => ({
        id: strategy.id.toString(),
        name: strategy.name,
        description: strategy.description,
        icon: getStrategyIcon(strategy.type),
        iconColor: getStrategyColor(strategy.type),
        performance: {
          value: `${strategy.performance > 0 ? '+' : ''}${strategy.performance.toFixed(1)}% 24h`,
          isPositive: strategy.performance > 0
        },
        isActive: strategy.isActive
      }));
      
      res.json({
        strategies: formattedStrategies
      });
    } catch (error) {
      console.error('Error fetching strategies:', error);
      res.status(500).json({ message: 'Failed to fetch strategies' });
    }
  });

  // Get active strategies
  router.get('/active', async (req, res) => {
    try {
      const strategies = await storage.getActiveStrategies();
      
      // Format strategies for frontend
      const formattedStrategies = strategies.map(strategy => ({
        id: strategy.id.toString(),
        name: strategy.name,
        description: strategy.description,
        icon: getStrategyIcon(strategy.type),
        iconColor: getStrategyColor(strategy.type),
        performance: {
          value: `${strategy.performance > 0 ? '+' : ''}${strategy.performance.toFixed(1)}% 24h`,
          isPositive: strategy.performance > 0
        },
        isActive: strategy.isActive
      }));
      
      res.json({
        strategies: formattedStrategies
      });
    } catch (error) {
      console.error('Error fetching active strategies:', error);
      res.status(500).json({ message: 'Failed to fetch active strategies' });
    }
  });

  // Toggle strategy status (activate/deactivate)
  router.post('/:id/toggle', async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);
      
      if (isNaN(strategyId)) {
        return res.status(400).json({ message: 'Invalid strategy ID' });
      }
      
      // Get current strategy
      const strategy = await storage.getStrategy(strategyId);
      
      if (!strategy) {
        return res.status(404).json({ message: 'Strategy not found' });
      }
      
      // Toggle the active status
      const updatedStrategy = await storage.updateStrategyStatus(
        strategyId,
        !strategy.isActive
      );
      
      if (!updatedStrategy) {
        return res.status(500).json({ message: 'Failed to update strategy status' });
      }
      
      res.json({
        message: `Strategy ${updatedStrategy.isActive ? 'activated' : 'deactivated'} successfully`,
        strategy: {
          id: updatedStrategy.id.toString(),
          name: updatedStrategy.name,
          isActive: updatedStrategy.isActive
        }
      });
    } catch (error) {
      console.error('Error toggling strategy status:', error);
      res.status(500).json({ message: 'Failed to toggle strategy status' });
    }
  });

  // Deploy new strategy
  router.post('/deploy', async (req, res) => {
    try {
      // In a real app, we would get user ID from authentication
      const userId = 1; // Assuming user ID 1
      
      // Generate a new strategy with some variation
      const strategyTypes = ['ARBITRAGE', 'MOMENTUM', 'LIQUIDITY'];
      const selectedType = strategyTypes[Math.floor(Math.random() * strategyTypes.length)];
      
      const strategyCountByType = await getStrategyCountByType(selectedType);
      const newStrategy = await storage.createStrategy({
        userId,
        name: generateStrategyName(selectedType, strategyCountByType + 1),
        description: generateStrategyDescription(selectedType),
        type: selectedType,
        performance: 0, // New strategy starts with 0 performance
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      res.status(201).json({
        message: 'Strategy deployed successfully',
        strategy: {
          id: newStrategy.id.toString(),
          name: newStrategy.name,
          description: newStrategy.description,
          icon: getStrategyIcon(newStrategy.type),
          iconColor: getStrategyColor(newStrategy.type),
          performance: {
            value: `0.0% 24h`,
            isPositive: true
          },
          isActive: newStrategy.isActive
        }
      });
    } catch (error) {
      console.error('Error deploying new strategy:', error);
      res.status(500).json({ message: 'Failed to deploy new strategy' });
    }
  });

  // Update strategy parameters
  router.patch('/:id', async (req, res) => {
    try {
      const strategyId = parseInt(req.params.id);
      
      if (isNaN(strategyId)) {
        return res.status(400).json({ message: 'Invalid strategy ID' });
      }
      
      const strategySchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(['ARBITRAGE', 'MOMENTUM', 'LIQUIDITY']).optional()
      });
      
      const validationResult = strategySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid strategy data' });
      }
      
      // Get current strategy
      const strategy = await storage.getStrategy(strategyId);
      
      if (!strategy) {
        return res.status(404).json({ message: 'Strategy not found' });
      }
      
      // In a real app, we would update the strategy here
      // For now, we'll just return success
      
      res.json({
        message: 'Strategy updated successfully',
        strategy: {
          id: strategy.id.toString(),
          name: req.body.name || strategy.name,
          description: req.body.description || strategy.description,
          type: req.body.type || strategy.type
        }
      });
    } catch (error) {
      console.error('Error updating strategy:', error);
      res.status(500).json({ message: 'Failed to update strategy' });
    }
  });

  return router;
}

/**
 * Helper functions for strategy management
 */

// Generate a strategy name based on type and count
function generateStrategyName(type: string, count: number): string {
  switch (type) {
    case 'ARBITRAGE': return `Alpha-${count} Arbitrage`;
    case 'MOMENTUM': return `Gamma-${count} Momentum`;
    case 'LIQUIDITY': return `Beta-${count} Liquidity`;
    default: return `Strategy-${count}`;
  }
}

// Generate a strategy description based on type
function generateStrategyDescription(type: string): string {
  switch (type) {
    case 'ARBITRAGE': return 'Cross-DEX arbitrage opportunities';
    case 'MOMENTUM': return 'Short-term trend following';
    case 'LIQUIDITY': return 'Automated liquidity provision';
    default: return 'Custom trading strategy';
  }
}

// Get strategy icon based on type
function getStrategyIcon(type: string): string {
  return 'smart_toy'; // Using the same icon for all strategies for now
}

// Get strategy color based on type
function getStrategyColor(type: string): string {
  switch (type) {
    case 'ARBITRAGE': return 'primary';
    case 'MOMENTUM': return 'danger';
    case 'LIQUIDITY': return 'warning';
    default: return 'info';
  }
}

// Get count of strategies by type
async function getStrategyCountByType(type: string): Promise<number> {
  const strategies = await storage.getStrategiesByUserId(1); // Assuming user ID 1
  return strategies.filter(s => s.type === type).length;
}
