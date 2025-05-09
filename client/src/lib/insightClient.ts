import { LearningInsight, InsightResult } from '../../shared/schema';
import { apiRequest } from './queryClient';
import { useWsStore } from './wsClient';

// Define the market analysis result interface
export interface MarketAnalysisResult {
  trends: string[];
  keyLevels: { 
    support: number[]; 
    resistance: number[] 
  };
  sentiment: 'bullish' | 'bearish' | 'neutral';
  volatilityAssessment: string;
  potentialCatalysts: string[];
  confidenceScore: number;
}

/**
 * Get all learning insights
 */
export async function getAllInsights(): Promise<LearningInsight[]> {
  const response = await apiRequest<{ insights: LearningInsight[] }>('/api/insights');
  return response.insights || [];
}

/**
 * Get insights for a specific agent type
 */
export async function getAgentInsights(agentType: string): Promise<LearningInsight[]> {
  const response = await apiRequest<{ insights: LearningInsight[] }>(`/api/insights/${agentType}`);
  return response.insights || [];
}

/**
 * Apply a learning insight
 */
export async function applyInsight(
  insightId: string, 
  success: boolean, 
  performanceDelta: number, 
  notes: string
): Promise<{ success: boolean }> {
  const response = await apiRequest<{ success: boolean }>(
    `/api/insights/${insightId}/apply`, 
    'POST',
    { success, performance_delta: performanceDelta, notes }
  );
  return response;
}

/**
 * Get all insights via WebSocket
 */
export function fetchAllInsightsViaWs(): Promise<LearningInsight[]> {
  return new Promise((resolve) => {
    const wsStore = useWsStore.getState();
    const requestId = `insights_${Date.now()}`;
    
    const messageHandler = (message: any) => {
      if (message.type === 'LEARNING_INSIGHTS' && message.requestId === requestId) {
        wsStore.removeListener(messageHandler);
        resolve(message.data.insights || []);
      }
    };
    
    wsStore.addListener(messageHandler);
    wsStore.sendMessage({
      type: 'GET_LEARNING_INSIGHTS',
      requestId
    });
  });
}

/**
 * Get agent insights via WebSocket
 */
export function fetchAgentInsightsViaWs(agentType: string): Promise<LearningInsight[]> {
  return new Promise((resolve) => {
    const wsStore = useWsStore.getState();
    const requestId = `agent_insights_${Date.now()}`;
    
    const messageHandler = (message: any) => {
      if (message.type === 'AGENT_INSIGHTS' && message.requestId === requestId) {
        wsStore.removeListener(messageHandler);
        resolve(message.data.insights || []);
      }
    };
    
    wsStore.addListener(messageHandler);
    wsStore.sendMessage({
      type: 'GET_AGENT_INSIGHTS',
      agentType,
      requestId
    });
  });
}

/**
 * Apply insight via WebSocket
 */
export function applyInsightViaWs(
  insightId: string, 
  success: boolean, 
  performanceDelta: number, 
  notes: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const wsStore = useWsStore.getState();
    const requestId = `apply_insight_${Date.now()}`;
    
    const messageHandler = (message: any) => {
      if (message.type === 'INSIGHT_APPLIED' && message.requestId === requestId) {
        wsStore.removeListener(messageHandler);
        resolve(message.data.success || false);
      }
    };
    
    wsStore.addListener(messageHandler);
    wsStore.sendMessage({
      type: 'APPLY_INSIGHT',
      insightId,
      success,
      performanceDelta,
      notes,
      requestId
    });
  });
}

/**
 * Get market pattern analysis for a specific trading pair
 * This uses the Perplexity AI to analyze current market data
 */
export async function getMarketPatternAnalysis(pair: string): Promise<{
  pair: string;
  marketAnalysis: MarketAnalysisResult;
  timestamp: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      pair: string;
      marketAnalysis: MarketAnalysisResult;
      timestamp: string;
    }>(`/api/ai/market-pattern-analysis/${pair}`, 'GET');
    
    if (!response.success) {
      throw new Error(`Failed to get market analysis for ${pair}`);
    }
    
    return {
      pair: response.pair,
      marketAnalysis: response.marketAnalysis,
      timestamp: response.timestamp
    };
  } catch (error: any) {
    console.error('Error getting market pattern analysis:', error);
    throw new Error(error.message || `Failed to get market analysis for ${pair}`);
  }
}