/**
 * Trading Agents Index
 * 
 * This file exports all three trading agents:
 * 1. Hyperion - Flash Arbitrage Overlord (zero-capital strategies)
 * 2. Quantum Omega - Sniper Supreme (precision token sniping)
 * 3. Singularity - Cross-Chain Strategy Master (cross-chain arbitrage)
 */

import { hyperionAgent } from './hyperion';
import { quantumOmegaAgent } from './quantum-omega';
import { singularityAgent } from './singularity';
import { logger } from '../logger';

// Types for agent activation
export type AgentType = 'hyperion' | 'quantum-omega' | 'singularity';

export interface AgentActivationResult {
  success: boolean;
  message: string;
  agentType: AgentType;
}

/**
 * Activate a specific agent
 */
export async function activateAgent(
  type: AgentType,
  primaryWallet: string,
  secondaryWallet?: string,
  profitWallet?: string
): Promise<AgentActivationResult> {
  try {
    logger.info(`Activating ${type} agent`);
    
    // Use the provided profit wallet or the primary wallet if none is provided
    const profitWalletAddress = profitWallet || primaryWallet;
    
    let success = false;
    
    switch (type) {
      case 'hyperion':
        // Hyperion only needs a strategy vault and profit wallet
        success = await hyperionAgent.activate(
          primaryWallet, 
          profitWalletAddress
        );
        break;
        
      case 'quantum-omega':
        // Quantum Omega needs a snipe vault and profit wallet
        success = await quantumOmegaAgent.activate(
          primaryWallet,
          profitWalletAddress
        );
        break;
        
      case 'singularity':
        // Singularity needs source, target, and profit wallets
        success = await singularityAgent.activate(
          primaryWallet,
          secondaryWallet || primaryWallet,
          profitWalletAddress
        );
        break;
        
      default:
        return {
          success: false,
          message: `Unknown agent type: ${type}`,
          agentType: type
        };
    }
    
    const message = success
      ? `Successfully activated ${type} agent`
      : `Failed to activate ${type} agent`;
    
    return {
      success,
      message,
      agentType: type
    };
  } catch (error) {
    logger.error(`Error activating ${type} agent:`, error);
    return {
      success: false,
      message: `Error activating ${type} agent: ${error.message}`,
      agentType: type
    };
  }
}

/**
 * Deactivate a specific agent
 */
export async function deactivateAgent(type: AgentType): Promise<AgentActivationResult> {
  try {
    logger.info(`Deactivating ${type} agent`);
    
    let success = false;
    
    switch (type) {
      case 'hyperion':
        success = await hyperionAgent.deactivate();
        break;
        
      case 'quantum-omega':
        success = await quantumOmegaAgent.deactivate();
        break;
        
      case 'singularity':
        success = await singularityAgent.deactivate();
        break;
        
      default:
        return {
          success: false,
          message: `Unknown agent type: ${type}`,
          agentType: type
        };
    }
    
    const message = success
      ? `Successfully deactivated ${type} agent`
      : `Failed to deactivate ${type} agent`;
    
    return {
      success,
      message,
      agentType: type
    };
  } catch (error) {
    logger.error(`Error deactivating ${type} agent:`, error);
    return {
      success: false,
      message: `Error deactivating ${type} agent: ${error.message}`,
      agentType: type
    };
  }
}

/**
 * Activate all agents
 */
export async function activateAllAgents(
  primaryWallet: string,
  secondaryWallet?: string,
  profitWallet?: string
): Promise<AgentActivationResult[]> {
  const results: AgentActivationResult[] = [];
  
  // Activate Hyperion
  results.push(await activateAgent('hyperion', primaryWallet, undefined, profitWallet));
  
  // Activate Quantum Omega
  results.push(await activateAgent('quantum-omega', primaryWallet, undefined, profitWallet));
  
  // Activate Singularity
  results.push(await activateAgent('singularity', primaryWallet, secondaryWallet, profitWallet));
  
  return results;
}

/**
 * Deactivate all agents
 */
export async function deactivateAllAgents(): Promise<AgentActivationResult[]> {
  const results: AgentActivationResult[] = [];
  
  // Deactivate Hyperion
  results.push(await deactivateAgent('hyperion'));
  
  // Deactivate Quantum Omega
  results.push(await deactivateAgent('quantum-omega'));
  
  // Deactivate Singularity
  results.push(await deactivateAgent('singularity'));
  
  return results;
}

/**
 * Get status for all agents
 */
export function getAllAgentsStatus(): any {
  return {
    hyperion: hyperionAgent.getStatus(),
    quantumOmega: quantumOmegaAgent.getStatus(),
    singularity: singularityAgent.getStatus()
  };
}

/**
 * Get status for a specific agent
 */
export function getAgentStatus(type: AgentType): any {
  switch (type) {
    case 'hyperion':
      return hyperionAgent.getStatus();
      
    case 'quantum-omega':
      return quantumOmegaAgent.getStatus();
      
    case 'singularity':
      return singularityAgent.getStatus();
      
    default:
      return { error: `Unknown agent type: ${type}` };
  }
}

// Export all agent instances for direct access if needed
export { hyperionAgent, quantumOmegaAgent, singularityAgent };