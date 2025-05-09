/**
 * Signal Client - Component-specific Signal Communication
 *
 * This module provides utilities for agent components to communicate with the signal system,
 * allowing them to receive and process signals targeted specifically for them.
 */

import { apiRequest } from "../queryClient";
import { SignalType, SignalStrength, SignalDirection, SignalPriority, SignalSource, BaseSignal } from "../../../../shared/signalTypes";

// Signal interface using the shared BaseSignal
export interface Signal extends BaseSignal {
  // Add client-specific properties here if needed
  timestamp: Date; // Override timestamp to ensure it's a Date object on the client
}

export interface ComponentSignalResponse {
  status: string;
  component: string;
  count: number;
  signals: Signal[];
  timestamp: string;
}

/**
 * Get signals targeted for a specific component
 * @param componentName Name of the component
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with signal data
 */
export async function getSignalsForComponent(
  componentName: string,
  limit: number = 50
): Promise<Signal[]> {
  try {
    const response = await apiRequest(
      "GET",
      `/api/signals/component/${componentName}?limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch signals: ${response.statusText}`);
    }
    
    const data: ComponentSignalResponse = await response.json();
    
    // Convert string timestamps to Date objects
    const signals = data.signals.map(signal => ({
      ...signal,
      timestamp: new Date(signal.timestamp)
    }));
    
    return signals;
  } catch (error) {
    console.error("Error fetching component signals:", error);
    return [];
  }
}

/**
 * Get signals filtered by type for a specific component
 * @param componentName Name of the component
 * @param signalType Type of signal to filter for
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with filtered signal data
 */
export async function getSignalsByTypeForComponent(
  componentName: string,
  signalType: SignalType,
  limit: number = 50
): Promise<Signal[]> {
  try {
    const signals = await getSignalsForComponent(componentName, limit);
    return signals.filter(signal => signal.type === signalType);
  } catch (error) {
    console.error("Error fetching component signals by type:", error);
    return [];
  }
}

/**
 * Filter signals by actionability
 * @param signals Array of signals
 * @param actionable Whether to return actionable or non-actionable signals
 * @returns Filtered signals
 */
export function filterSignalsByActionability(
  signals: Signal[],
  actionable: boolean = true
): Signal[] {
  return signals.filter(signal => signal.actionable === actionable);
}

/**
 * Get most recent high-priority signals for a component
 * @param componentName Name of the component
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with high-priority signals
 */
export async function getCriticalSignalsForComponent(
  componentName: string,
  limit: number = 10
): Promise<Signal[]> {
  try {
    const signals = await getSignalsForComponent(componentName, limit * 3);
    
    // Filter to only high priority signals and sort by timestamp (newest first)
    return signals
      .filter(signal => signal.priority >= SignalPriority.HIGH)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  } catch (error) {
    console.error("Error fetching critical signals:", error);
    return [];
  }
}

/**
 * Get all MEV opportunity signals for Hyperion agent
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with MEV opportunity signals
 */
export async function getMEVOpportunitySignals(limit: number = 20): Promise<Signal[]> {
  try {
    const signals = await getSignalsByTypeForComponent(
      "HyperionAgent", 
      SignalType.MEV_OPPORTUNITY,
      limit
    );
    
    return signals;
  } catch (error) {
    console.error("Error fetching MEV opportunity signals:", error);
    return [];
  }
}

/**
 * Get all flash loan opportunity signals
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with flash loan opportunity signals
 */
export async function getFlashLoanSignals(limit: number = 20): Promise<Signal[]> {
  try {
    const signals = await getSignalsByTypeForComponent(
      "HyperionAgent", 
      SignalType.FLASH_LOAN,
      limit
    );
    
    return signals;
  } catch (error) {
    console.error("Error fetching flash loan signals:", error);
    return [];
  }
}

/**
 * Get all arbitrage opportunity signals
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with arbitrage opportunity signals
 */
export async function getArbitrageSignals(limit: number = 20): Promise<Signal[]> {
  try {
    const signals = await getSignalsByTypeForComponent(
      "HyperionAgent", 
      SignalType.ARBITRAGE,
      limit
    );
    
    return signals;
  } catch (error) {
    console.error("Error fetching arbitrage signals:", error);
    return [];
  }
}

/**
 * Get all snipe opportunity signals for Quantum Omega agent
 * @param limit Maximum number of signals to retrieve
 * @returns Promise with snipe opportunity signals
 */
export async function getSnipeSignals(limit: number = 20): Promise<Signal[]> {
  try {
    const signals = await getSignalsByTypeForComponent(
      "QuantumOmegaAgent", 
      SignalType.SNIPE,
      limit
    );
    
    return signals;
  } catch (error) {
    console.error("Error fetching snipe signals:", error);
    return [];
  }
}

/**
 * Submit a new custom signal to the system
 * @param signal Signal data to submit
 * @returns Promise with submission result
 */
export async function submitCustomSignal(signal: Partial<Signal>): Promise<{ signalId: string }> {
  try {
    const response = await apiRequest("POST", "/api/signals", signal);
    
    if (!response.ok) {
      throw new Error(`Failed to submit signal: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { signalId: data.signalId };
  } catch (error) {
    console.error("Error submitting custom signal:", error);
    throw error;
  }
}