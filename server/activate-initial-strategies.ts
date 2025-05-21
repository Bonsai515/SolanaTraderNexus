/**
 * Activate Initial Trading Strategies
 * 
 * This script activates the minimal set of components needed
 * for our initial low-capital strategies.
 */

import * as logger from './logger';
import { getConnection } from './solana/connection-manager';
import { getTransactionHandler } from './quicknode-connector';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Trading configuration
interface StrategyConfig {
  enabled: boolean;
  name: string;
  minCapitalRequired: number;
  targetAllocation: number;
  maxPositionSize: number;
  priority: number;
  components: string[];
}

// Strategy definitions
const STRATEGIES: StrategyConfig[] = [
  {
    name: 'quantum-omega-sniper',
    enabled: true,
    minCapitalRequired: 0.05,
    targetAllocation: 0.35,
    maxPositionSize: 0.05,
    priority: 1,
    components: ['MemeCortexRemix', 'QuantumOmega']
  },
  {
    name: 'momentum-surfing',
    enabled: true,
    minCapitalRequired: 0.025,
    targetAllocation: 0.25,
    maxPositionSize: 0.025,
    priority: 2,
    components: ['SocialAnalyzer', 'MomentumSurfing']
  },
  {
    name: 'memecortex-supernova',
    enabled: true,
    minCapitalRequired: 0.035,
    targetAllocation: 0.30,
    maxPositionSize: 0.035,
    priority: 3,
    components: ['MemeCortexAdvanced', 'NexusEngine']
  },
  {
    name: 'flash-loan-arbitrage',
    enabled: false, // Will be enabled in second phase
    minCapitalRequired: 0.25,
    targetAllocation: 0.20,
    maxPositionSize: 0.25,
    priority: 4,
    components: ['Hyperion', 'NexusEngine']
  },
  {
    name: 'singularity-black-hole',
    enabled: false, // Will be enabled in second phase
    minCapitalRequired: 0.20,
    targetAllocation: 0.15,
    maxPositionSize: 0.20,
    priority: 5,
    components: ['Singularity', 'NexusEngine']
  },
  {
    name: 'hyperion-money-loop',
    enabled: false, // Will be enabled in final phase
    minCapitalRequired: 0.50,
    targetAllocation: 0.25,
    maxPositionSize: 0.50,
    priority: 6,
    components: ['Hyperion', 'NexusEngine', 'CrossChain']
  },
  {
    name: 'nuclear-strategies',
    enabled: false, // Will be enabled in final phase
    minCapitalRequired: 1.00,
    targetAllocation: 0.40,
    maxPositionSize: 1.00,
    priority: 7,
    components: ['MemeCortexRemix', 'QuantumOmega', 'Hyperion', 'NexusEngine']
  },
  {
    name: 'jito-borrow-arbitrage',
    enabled: false, // Will be enabled in final phase
    minCapitalRequired: 2.00,
    targetAllocation: 0.50,
    maxPositionSize: 2.00,
    priority: 8,
    components: ['Hyperion', 'NexusEngine', 'JitoBorrow']
  }
];

// Component mapping
interface ComponentActivator {
  name: string;
  module: string;
  function: string;
  required: boolean;
}

// Define component activators
const COMPONENT_ACTIVATORS: ComponentActivator[] = [
  {
    name: 'NeuralCommunicationHub',
    module: './neural-communication-hub',
    function: 'initialize',
    required: true
  },
  {
    name: 'MemeCortexRemix',
    module: './transformers/memeTokenNeuralTransformer',
    function: 'initialize',
    required: true
  },
  {
    name: 'QuantumOmega',
    module: './strategies/quantumOmegaSniperController',
    function: 'initialize',
    required: true
  },
  {
    name: 'SocialAnalyzer',
    module: './transformers/memecoin-social-analyzer',
    function: 'initialize',
    required: true
  },
  {
    name: 'MomentumSurfing',
    module: './strategies/momentum-surfing-strategy',
    function: 'initialize',
    required: true
  },
  {
    name: 'MemeCortexAdvanced',
    module: './transformers/MemeCortexAdvanced',
    function: 'initialize',
    required: true
  },
  {
    name: 'NexusEngine',
    module: './nexus-transaction-engine',
    function: 'initialize',
    required: true
  },
  {
    name: 'Hyperion',
    module: './strategies/hyperion-flash-arbitrage',
    function: 'initialize',
    required: false
  },
  {
    name: 'Singularity',
    module: './strategies/singularity-strategy',
    function: 'initialize',
    required: false
  },
  {
    name: 'CrossChain',
    module: './strategies/cross-chain-arbitrage',
    function: 'initialize',
    required: false
  },
  {
    name: 'JitoBorrow',
    module: './jito-integration/jito-borrower',
    function: 'initialize',
    required: false
  }
];

/**
 * Check wallet balance
 */
async function checkWalletBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection('confirmed', 'queries'); // Use queries endpoint to avoid rate limits
    const balance = await connection.getBalance(new PublicKey(walletAddress));
    return balance / 1_000_000_000; // Convert lamports to SOL
  } catch (error) {
    logger.error(`Error checking wallet balance: ${error.message}`);
    throw error;
  }
}

/**
 * Determine which strategies to activate based on available capital
 */
function determineActiveStrategies(availableCapital: number): StrategyConfig[] {
  // Sort strategies by priority
  const sortedStrategies = [...STRATEGIES].sort((a, b) => a.priority - b.priority);
  
  // Filter strategies that can be activated with available capital
  return sortedStrategies.filter(strategy => {
    // Always activate enabled strategies regardless of capital
    // This is for initial testing phase
    return strategy.enabled || strategy.minCapitalRequired <= availableCapital;
  });
}

/**
 * Get required components for active strategies
 */
function getRequiredComponents(activeStrategies: StrategyConfig[]): string[] {
  // Extract all components from active strategies
  const componentSet = new Set<string>();
  
  // Always include required components
  COMPONENT_ACTIVATORS.filter(c => c.required).forEach(c => componentSet.add(c.name));
  
  // Add strategy-specific components
  activeStrategies.forEach(strategy => {
    strategy.components.forEach(component => componentSet.add(component));
  });
  
  return Array.from(componentSet);
}

/**
 * Activate a single component
 */
async function activateComponent(componentName: string): Promise<boolean> {
  try {
    // Find component activator
    const activator = COMPONENT_ACTIVATORS.find(c => c.name === componentName);
    if (!activator) {
      logger.warn(`Component ${componentName} not found in activator list`);
      return false;
    }
    
    // Get the module
    const componentModule = require(activator.module);
    const initFunction = componentModule[activator.function];
    
    if (typeof initFunction !== 'function') {
      logger.error(`Initialization function ${activator.function} not found in module ${activator.module}`);
      return false;
    }
    
    // Call the initialization function
    const result = await initFunction();
    
    if (result) {
      logger.info(`✅ Successfully activated component: ${componentName}`);
      return true;
    } else {
      logger.error(`❌ Failed to activate component: ${componentName}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error activating component ${componentName}: ${error.message}`);
    return false;
  }
}

/**
 * Activate all required components
 */
async function activateComponents(components: string[]): Promise<{
  success: boolean;
  activatedComponents: string[];
  failedComponents: string[];
}> {
  const activatedComponents: string[] = [];
  const failedComponents: string[] = [];
  
  for (const component of components) {
    const success = await activateComponent(component);
    
    if (success) {
      activatedComponents.push(component);
    } else {
      failedComponents.push(component);
      
      // If this is a required component, we should abort
      const isRequired = COMPONENT_ACTIVATORS.find(c => c.name === component)?.required;
      if (isRequired) {
        logger.error(`Required component ${component} failed to activate. Aborting.`);
        return {
          success: false,
          activatedComponents,
          failedComponents
        };
      }
    }
  }
  
  return {
    success: failedComponents.length === 0,
    activatedComponents,
    failedComponents
  };
}

/**
 * Main function to activate initial strategies
 */
export async function activateInitialStrategies(walletAddress?: string): Promise<{
  success: boolean;
  activatedStrategies: string[];
  activatedComponents: string[];
  failedComponents: string[];
}> {
  try {
    logger.info('Starting activation of initial trading strategies...');
    
    // Use provided wallet address or default
    const systemWallet = walletAddress || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    
    // Check wallet balance
    logger.info(`Checking balance for wallet: ${systemWallet}`);
    const balance = await checkWalletBalance(systemWallet);
    logger.info(`Wallet balance: ${balance} SOL`);
    
    // Determine which strategies to activate
    const activeStrategies = determineActiveStrategies(balance);
    logger.info(`Selected ${activeStrategies.length} strategies for activation based on available capital`);
    activeStrategies.forEach(s => logger.info(`- ${s.name} (min capital: ${s.minCapitalRequired} SOL)`));
    
    // Get required components
    const requiredComponents = getRequiredComponents(activeStrategies);
    logger.info(`Activating ${requiredComponents.length} components for selected strategies`);
    
    // Activate components
    const activationResult = await activateComponents(requiredComponents);
    
    if (activationResult.success) {
      logger.info('✅ Successfully activated all required components');
    } else {
      logger.warn(`⚠️ Some components failed to activate: ${activationResult.failedComponents.join(', ')}`);
    }
    
    // Return summary
    return {
      success: activationResult.success,
      activatedStrategies: activeStrategies.map(s => s.name),
      activatedComponents: activationResult.activatedComponents,
      failedComponents: activationResult.failedComponents
    };
  } catch (error) {
    logger.error(`Error activating initial strategies: ${error.message}`);
    return {
      success: false,
      activatedStrategies: [],
      activatedComponents: [],
      failedComponents: ['Error: ' + error.message]
    };
  }
}

// Run activation if this script is executed directly
if (require.main === module) {
  activateInitialStrategies()
    .then(result => {
      if (result.success) {
        console.log('✅ Successfully activated initial trading strategies');
      } else {
        console.log('⚠️ Some components failed to activate');
      }
      console.log('Activated strategies:', result.activatedStrategies);
      console.log('Activated components:', result.activatedComponents);
      console.log('Failed components:', result.failedComponents);
    })
    .catch(error => {
      console.error('❌ Error during activation:', error);
    });
}

// Export for use from other modules
export default {
  activateInitialStrategies
};