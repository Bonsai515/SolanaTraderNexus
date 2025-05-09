/**
 * Test Script for Component-Targeted Signal System
 * 
 * This script demonstrates how components can subscribe to and receive
 * signals that are specifically targeted for them.
 */

import { SignalType, SignalStrength, SignalDirection, SignalPriority, SignalSource } from '../shared/signalTypes';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Custom signal with component targeting
const generateTestSignal = (targetComponent: string) => ({
  pair: 'SOL/USDC',
  type: SignalType.MEV_OPPORTUNITY,
  source: SignalSource.HYPERION_AGENT,
  strength: SignalStrength.STRONG,
  direction: SignalDirection.BULLISH,
  priority: SignalPriority.HIGH,
  confidence: 85,
  description: `Test targeted signal for ${targetComponent}`,
  metadata: {
    opportunityType: 'cross-dex-arb',
    estimatedProfit: '0.05',
    route: ['jupiter', 'raydium']
  },
  actionable: true,
  token_address: 'So11111111111111111111111111111111111111112', // SOL token address
  analysis: {
    arbitrageSize: 0.05,
    executionComplexity: 3.2,
    gasEstimate: 0.001,
    competitionLevel: 42.5
  },
  metrics: {
    profitPotential: 0.05,
    successProbability: 0.78,
    timeWindow: 5,
    gasEfficiency: 85.3
  },
  targetComponents: [targetComponent]
});

// Submit a test signal targeted for a specific component
async function submitComponentSignal(componentName: string) {
  try {
    console.log(`Submitting test signal targeted for ${componentName}...`);
    
    const signal = generateTestSignal(componentName);
    const response = await axios.post(`${API_BASE_URL}/signals`, signal);
    
    console.log('Signal submitted successfully!');
    console.log('Signal ID:', response.data.signalId);
    
    return response.data.signalId;
  } catch (error) {
    console.error('Error submitting signal:', error.response?.data || error.message);
    throw error;
  }
}

// Fetch signals for a specific component
async function getComponentSignals(componentName: string) {
  try {
    console.log(`Fetching signals targeted for ${componentName}...`);
    
    const response = await axios.get(`${API_BASE_URL}/signals/component/${componentName}`);
    
    console.log(`Found ${response.data.count} signals for ${componentName}`);
    console.log('Signal data:');
    console.log(JSON.stringify(response.data.signals, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error fetching component signals:', error.response?.data || error.message);
    throw error;
  }
}

// Test the entire flow
async function testComponentSignalFlow() {
  try {
    // Create signals for different components
    console.log('=== Testing Component Signal Flow ===');
    
    // Create signals targeted to specific components
    await submitComponentSignal('HyperionAgent');
    await submitComponentSignal('QuantumOmegaAgent');
    await submitComponentSignal('TransactionEngine');
    
    // Wait for signals to propagate
    console.log('Waiting for signals to propagate...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch signals for each component
    await getComponentSignals('HyperionAgent');
    await getComponentSignals('QuantumOmegaAgent');
    await getComponentSignals('TransactionEngine');
    
    console.log('=== Component Signal Flow Test Complete ===');
  } catch (error) {
    console.error('Error in test flow:', error);
  }
}

// Run the test
testComponentSignalFlow().catch(console.error);