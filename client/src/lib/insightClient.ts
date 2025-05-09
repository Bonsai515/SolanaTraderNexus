import { LearningInsight, InsightResult } from '../../shared/schema';
import { apiRequest } from './queryClient';
import { useWsStore } from './wsClient';

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