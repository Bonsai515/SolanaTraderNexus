/**
 * Strategy Routes
 * 
 * This file contains API routes for managing trading strategies.
 */

import express from 'express';
import { 
  selectTopStrategies, 
  getAllStrategies, 
  getStrategyById, 
  activateStrategies, 
  deactivateStrategies,
  getActiveStrategies 
} from './strategy-selector';
import { strategyController } from './strategy-controller';
import logger from "./logger"

import { Router } from 'express';
const strategyRouter = Router();

// Get all strategies
strategyRouter.get('/', (req, res) => {
  try {
    const strategies = getAllStrategies();
    res.json(strategies);
  } catch (error) {
    logger.error('Error getting strategies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting strategies',
      error: error.message || 'Unknown error'
    });
  }
});

// Get a strategy by ID
strategyRouter.get('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const strategy = getStrategyById(id);

    if (!strategy) {
      return res.status(404).json({
        status: 'error',
        message: `Strategy with ID ${id} not found`
      });
    }

    res.json(strategy);
  } catch (error) {
    logger.error(`Error getting strategy ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting strategy',
      error: error.message || 'Unknown error'
    });
  }
});

// Get active strategies
strategyRouter.get('/active/list', (req, res) => {
  try {
    const strategies = strategyController.getActiveStrategies();
    res.json(strategies);
  } catch (error) {
    logger.error('Error getting active strategies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting active strategies',
      error: error.message || 'Unknown error'
    });
  }
});

// Get top strategies
strategyRouter.get('/top/list', (req, res) => {
  try {
    const yieldCount = req.query.yieldCount ? parseInt(req.query.yieldCount as string, 10) : 2;
    const successRateCount = req.query.successRateCount ? parseInt(req.query.successRateCount as string, 10) : 1;
    const minSuccessRate = req.query.minSuccessRate ? parseInt(req.query.minSuccessRate as string, 10) : 30;
    const minYield = req.query.minYield ? parseInt(req.query.minYield as string, 10) : 5;

    const strategies = selectTopStrategies(
      yieldCount,
      successRateCount,
      minSuccessRate,
      minYield
    );

    res.json(strategies);
  } catch (error) {
    logger.error('Error getting top strategies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting top strategies',
      error: error.message || 'Unknown error'
    });
  }
});

// Activate strategies
strategyRouter.post('/activate', (req, res) => {
  try {
    const { strategyIds } = req.body;

    if (!Array.isArray(strategyIds) || strategyIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or invalid strategyIds parameter'
      });
    }

    const activated = activateStrategies(strategyIds);
    strategyController.activateStrategies(strategyIds);

    res.json({
      status: 'success',
      message: `Activated ${activated.length} strategies`,
      strategies: activated
    });
  } catch (error) {
    logger.error('Error activating strategies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error activating strategies',
      error: error.message || 'Unknown error'
    });
  }
});

// Deactivate strategies
strategyRouter.post('/deactivate', (req, res) => {
  try {
    const { strategyIds } = req.body;

    if (!Array.isArray(strategyIds) || strategyIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or invalid strategyIds parameter'
      });
    }

    const deactivated = deactivateStrategies(strategyIds);
    strategyController.deactivateStrategies(strategyIds);

    res.json({
      status: 'success',
      message: `Deactivated ${deactivated.length} strategies`,
      strategies: deactivated
    });
  } catch (error) {
    logger.error('Error deactivating strategies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deactivating strategies',
      error: error.message || 'Unknown error'
    });
  }
});

// Start strategy controller with top strategies
strategyRouter.post('/start', (req, res) => {
  try {
    const { 
      yieldCount = 2, 
      successRateCount = 1,
      minSuccessRate = 30,
      minYield = 5,
      interval = 60000
    } = req.body;

    // Initialize controller with top strategies
    strategyController.selectAndActivateTopStrategies(
      yieldCount,
      successRateCount,
      minSuccessRate,
      minYield
    );

    // Start controller
    strategyController.start(interval);

    const activeStrategies = strategyController.getActiveStrategies();

    res.json({
      status: 'success',
      message: 'Strategy controller started with top strategies',
      activeStrategies,
      controllerStatus: strategyController.getStatus()
    });
  } catch (error) {
    logger.error('Error starting strategy controller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error starting strategy controller',
      error: error.message || 'Unknown error'
    });
  }
});

// Stop strategy controller
strategyRouter.post('/stop', (req, res) => {
  try {
    strategyController.stop();

    res.json({
      status: 'success',
      message: 'Strategy controller stopped',
      controllerStatus: strategyController.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping strategy controller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error stopping strategy controller',
      error: error.message || 'Unknown error'
    });
  }
});

// Get strategy controller status
strategyRouter.get('/status', (req, res) => {
  try {
    const status = strategyController.getStatus();
    const activeStrategies = strategyController.getActiveStrategies();

    res.json({
      status: 'success',
      controllerStatus: status,
      activeStrategies
    });
  } catch (error) {
    logger.error('Error getting strategy controller status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting strategy controller status',
      error: error.message || 'Unknown error'
    });
  }
});

export default strategyRouter;