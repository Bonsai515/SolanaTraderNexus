/**
 * AI Services Activation Script
 * 
 * This script initializes and activates the Perplexity and DeepSeek AI services
 * to enhance the AI trading capabilities of the system.
 */

import { logger } from '../logger';
import { getPerplexityService } from './perplexityService';
import { getDeepSeekService } from './deepSeekService';
import { getNeuralHybridService } from './neuralHybridService';

// Check API keys and initialize services
export async function activateAIServices(): Promise<boolean> {
  logger.info('Activating AI services for enhanced trading capabilities...');
  
  // Check for required API keys
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!perplexityApiKey) {
    logger.warn('Perplexity API key not found. Some AI features will be limited.');
  } else {
    logger.info('Perplexity API key found. Initializing Perplexity service...');
  }
  
  if (!deepseekApiKey) {
    logger.warn('DeepSeek API key not found. Some AI features will be limited.');
  } else {
    logger.info('DeepSeek API key found. Initializing DeepSeek service...');
  }
  
  try {
    // Initialize Perplexity Service
    const perplexityService = getPerplexityService();
    const perplexityInitialized = await perplexityService.initialize();
    
    if (perplexityInitialized) {
      logger.info('✅ Perplexity service initialized successfully');
    } else {
      logger.warn('⚠️ Perplexity service initialization incomplete');
    }
    
    // Initialize DeepSeek Service
    const deepseekService = getDeepSeekService();
    const deepseekInitialized = await deepseekService.initialize();
    
    if (deepseekInitialized) {
      logger.info('✅ DeepSeek service initialized successfully');
    } else {
      logger.warn('⚠️ DeepSeek service initialization incomplete');
    }
    
    // Initialize Neural Hybrid Service (combines both AI services)
    const neuralHybridService = getNeuralHybridService();
    const neuralHybridInitialized = await neuralHybridService.initialize();
    
    if (neuralHybridInitialized) {
      logger.info('✅ Neural Hybrid service initialized successfully');
      logger.info('✅ AI services activated and ready for strategy enhancement');
      
      return true;
    } else {
      logger.warn('⚠️ Neural Hybrid service initialization incomplete');
      return false;
    }
  } catch (error) {
    logger.error('Error activating AI services:', error);
    return false;
  }
}

// Execute immediately if this script is run directly
if (require.main === module) {
  activateAIServices().then(success => {
    if (success) {
      logger.info('AI services activation complete');
    } else {
      logger.warn('AI services activation incomplete');
    }
  }).catch(error => {
    logger.error('AI services activation failed:', error);
  });
}

export default {
  activateAIServices
};