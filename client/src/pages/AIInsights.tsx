import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  fetchAllInsightsViaWs, 
  fetchAgentInsightsViaWs, 
  applyInsightViaWs,
  getMarketPatternAnalysis,
  MarketAnalysisResult
} from '../lib/insightClient';
import { LearningInsight, InsightType } from '../../shared/schema';

const InsightTypeBadge = ({ type }: { type: InsightType }) => {
  let color = '';
  
  switch (type) {
    case InsightType.TIME_BASED_EXECUTION:
      color = 'bg-blue-500';
      break;
    case InsightType.PAIR_PERFORMANCE:
      color = 'bg-green-500';
      break;
    case InsightType.DEX_PREFERENCE:
      color = 'bg-yellow-500';
      break;
    case InsightType.FAILURE_PATTERN:
      color = 'bg-red-500';
      break;
    case InsightType.PROFIT_OPTIMIZATION:
      color = 'bg-purple-500';
      break;
    case InsightType.RISK_MANAGEMENT:
      color = 'bg-orange-500';
      break;
    default:
      color = 'bg-gray-500';
  }
  
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${color}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
};

const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
  let color = '';
  
  if (confidence >= 0.8) {
    color = 'bg-green-500';
  } else if (confidence >= 0.6) {
    color = 'bg-yellow-500';
  } else {
    color = 'bg-gray-500';
  }
  
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${color}`}>
      {Math.round(confidence * 100)}% Confidence
    </span>
  );
};

const InsightCard = ({ 
  insight, 
  onApply 
}: { 
  insight: LearningInsight; 
  onApply: (id: string, success: boolean, performanceDelta: number, notes: string) => Promise<void>;
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [notes, setNotes] = useState('');
  
  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(insight.id, true, 0, notes || 'Applied via UI');
    } finally {
      setIsApplying(false);
    }
  };
  
  return (
    <div className="bg-slate-800 rounded-lg shadow-md p-4 mb-4 border border-slate-700">
      <div className="flex justify-between items-start mb-2">
        <div className="flex space-x-2">
          <InsightTypeBadge type={insight.insight_type} />
          <ConfidenceBadge confidence={insight.confidence} />
        </div>
        <div className="text-xs text-slate-400">
          {new Date(insight.created_at).toLocaleString()}
        </div>
      </div>
      
      <h3 className="text-lg font-semibold mb-2 text-slate-200">{insight.description}</h3>
      
      <div className="text-slate-300 mb-3">
        <strong>Recommendation:</strong> {insight.recommendation}
      </div>
      
      {insight.pair && (
        <div className="text-xs text-slate-400 mb-1">
          <strong>Pair:</strong> {insight.pair}
        </div>
      )}
      
      <div className="text-xs text-slate-400 mb-3">
        <strong>Strategy:</strong> {insight.strategy_id}
      </div>
      
      {insight.applied ? (
        <div className="bg-green-900/30 text-green-300 p-2 rounded text-sm">
          <div className="font-bold">Applied on {new Date(insight.result?.applied_at || '').toLocaleString()}</div>
          {insight.result?.notes && <div>{insight.result.notes}</div>}
          {typeof insight.result?.performance_delta === 'number' && (
            <div>Performance change: {(insight.result.performance_delta * 100).toFixed(2)}%</div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <textarea 
            className="w-full bg-slate-700 text-slate-200 rounded p-2 text-sm mb-2"
            placeholder="Add notes about applying this insight"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            onClick={handleApply}
            disabled={isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply Insight'}
          </button>
        </div>
      )}
    </div>
  );
};

// Market Pattern Analysis Component
const MarketPatternAnalysis = () => {
  const [selectedPair, setSelectedPair] = useState('SOL/USDC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MarketAnalysisResult | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  
  const pairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];
  
  const fetchMarketAnalysis = async () => {
    if (!selectedPair) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getMarketPatternAnalysis(selectedPair);
      setAnalysis(result.marketAnalysis);
      setTimestamp(result.timestamp);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch market analysis');
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getSentimentColor = (sentiment: string) => {
    switch(sentiment) {
      case 'bullish': return 'text-green-400';
      case 'bearish': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };
  
  return (
    <div className="bg-slate-800 rounded-lg shadow-md p-4 mb-6 border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 text-slate-200">AI-Powered Market Pattern Analysis</h3>
      
      <div className="flex items-center mb-4 space-x-4">
        <div className="flex-grow">
          <select
            className="w-full bg-slate-700 text-slate-200 rounded p-2"
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
          >
            {pairs.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
          onClick={fetchMarketAnalysis}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              Analyzing...
            </div>
          ) : 'Analyze Patterns'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-900/30 text-red-300 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {analysis && (
        <div className="border border-slate-700 rounded p-4 bg-slate-800/50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-medium text-slate-100">
              {selectedPair} Analysis
            </h4>
            <div className={`font-semibold ${getSentimentColor(analysis.sentiment)}`}>
              {analysis.sentiment.toUpperCase()} 
              <span className="ml-2 bg-slate-700 px-2 py-1 rounded text-xs text-slate-300">
                {(analysis.confidenceScore * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-sm font-semibold text-slate-400 mb-2">Market Trends</h5>
              <ul className="list-disc pl-5 text-slate-300 text-sm">
                {analysis.trends.map((trend, idx) => (
                  <li key={idx}>{trend}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h5 className="text-sm font-semibold text-slate-400 mb-2">Key Levels</h5>
              <div className="text-slate-300 text-sm">
                <div className="flex">
                  <span className="font-medium text-green-400 w-24">Support:</span>
                  <span>
                    {analysis.keyLevels.support.map(level => `$${level.toFixed(4)}`).join(', ')}
                  </span>
                </div>
                <div className="flex mt-1">
                  <span className="font-medium text-red-400 w-24">Resistance:</span>
                  <span>
                    {analysis.keyLevels.resistance.map(level => `$${level.toFixed(4)}`).join(', ')}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="text-sm font-semibold text-slate-400 mb-2">Volatility Assessment</h5>
              <p className="text-slate-300 text-sm">{analysis.volatilityAssessment}</p>
            </div>
            
            <div>
              <h5 className="text-sm font-semibold text-slate-400 mb-2">Potential Catalysts</h5>
              <ul className="list-disc pl-5 text-slate-300 text-sm">
                {analysis.potentialCatalysts.map((catalyst, idx) => (
                  <li key={idx}>{catalyst}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {timestamp && (
            <div className="mt-4 text-right text-xs text-slate-500">
              Generated at {new Date(timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FilterPanel = ({ 
  agentFilter, 
  setAgentFilter,
  typeFilter,
  setTypeFilter
}: { 
  agentFilter: string | null;
  setAgentFilter: (agent: string | null) => void;
  typeFilter: InsightType | null;
  setTypeFilter: (type: InsightType | null) => void;
}) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
      <h3 className="text-lg font-semibold mb-3 text-slate-200">Filters</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Agent Type</label>
          <select 
            className="w-full bg-slate-700 text-slate-200 rounded p-2"
            value={agentFilter || ''}
            onChange={(e) => setAgentFilter(e.target.value || null)}
          >
            <option value="">All Agents</option>
            <option value="Hyperion">Hyperion</option>
            <option value="QuantumOmega">Quantum Omega</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-400 mb-1">Insight Type</label>
          <select 
            className="w-full bg-slate-700 text-slate-200 rounded p-2"
            value={typeFilter || ''}
            onChange={(e) => setTypeFilter(e.target.value as InsightType || null)}
          >
            <option value="">All Types</option>
            {Object.values(InsightType).map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default function AIInsights() {
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<InsightType | null>(null);
  
  // Use WebSocket to fetch insights initially
  const { data: insights = [], isLoading, refetch } = useQuery({
    queryKey: ['insights', agentFilter],
    queryFn: () => agentFilter 
      ? fetchAgentInsightsViaWs(agentFilter)
      : fetchAllInsightsViaWs(),
  });
  
  // Filter insights by type
  const filteredInsights = typeFilter
    ? insights.filter(insight => insight.insight_type === typeFilter)
    : insights;
  
  // Sort insights by created_at (newest first) and then by confidence (highest first)
  const sortedInsights = [...filteredInsights].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    
    return b.confidence - a.confidence;
  });
  
  const handleApplyInsight = async (id: string, success: boolean, performanceDelta: number, notes: string) => {
    await applyInsightViaWs(id, success, performanceDelta, notes);
    refetch();
  };
  
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-100">AI Learning Insights</h1>
        <button 
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded flex items-center"
          onClick={() => refetch()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      
      {/* AI Market Pattern Analysis Section */}
      <MarketPatternAnalysis />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <FilterPanel 
            agentFilter={agentFilter}
            setAgentFilter={setAgentFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
          />
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-semibold mb-3 text-slate-200">Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-slate-100">{insights.length}</div>
                <div className="text-xs text-slate-400">Total Insights</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-slate-100">
                  {insights.filter(i => i.applied).length}
                </div>
                <div className="text-xs text-slate-400">Applied</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-slate-100">
                  {Object.values(InsightType).reduce((count, type) => {
                    const insightsOfType = insights.filter(i => i.insight_type === type);
                    return insightsOfType.length > 0 ? count + 1 : count;
                  }, 0)}
                </div>
                <div className="text-xs text-slate-400">Types</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-slate-100">
                  {new Set(insights.map(i => i.strategy_id)).size}
                </div>
                <div className="text-xs text-slate-400">Strategies</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-3">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Learning Insights History</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : sortedInsights.length > 0 ? (
            sortedInsights.map(insight => (
              <InsightCard 
                key={insight.id}
                insight={insight}
                onApply={handleApplyInsight}
              />
            ))
          ) : (
            <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
              <div className="text-xl text-slate-300 mb-2">No insights found</div>
              <div className="text-slate-400">
                {agentFilter || typeFilter 
                  ? "Try changing the filters or training more agents"
                  : "The system will generate insights as agents execute strategies"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}