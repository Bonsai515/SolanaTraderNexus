import { BaseSignal, SignalSource, SignalType, SignalStrength, SignalDirection, SignalPriority } from '../shared/signalTypes';

// Signal interface for dashboard display
export interface Signal extends BaseSignal {
  sourceToken: string;
  targetToken: string;
  amount?: number;
  status: string;
  transactionSignature?: string;
  direction: SignalDirection;
}

/**
 * Generates a static HTML dashboard to display trading signals
 */
export function generateStaticDashboard(signals: Signal[]): string {
  const sortedSignals = [...signals].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const signalRows = sortedSignals.map(signal => {
    const statusClass = signal.status === 'EXECUTED' ? 'status-executed' : 
                        signal.status === 'PENDING' ? 'status-pending' : 
                        signal.status === 'FAILED' ? 'status-failed' : 'status-default';
    
    const signalTime = new Date(signal.timestamp).toLocaleTimeString();
    const signalDate = new Date(signal.timestamp).toLocaleDateString();
    
    // Format transaction signature for better readability
    const txSignature = signal.transactionSignature ? 
      `${signal.transactionSignature.substring(0, 8)}...${signal.transactionSignature.substring(signal.transactionSignature.length - 8)}` : 
      'N/A';

    return `
      <tr>
        <td>${signal.id.substring(0, 10)}...</td>
        <td>${signal.source}</td>
        <td>${signal.type}</td>
        <td>${signal.sourceToken} → ${signal.targetToken}</td>
        <td>${signal.direction}</td>
        <td>${signal.amount ? '$' + signal.amount.toFixed(2) : 'N/A'}</td>
        <td class="${statusClass}">${signal.status}</td>
        <td>${txSignature}</td>
        <td>${signalDate} ${signalTime}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Solana Quantum Trading Platform - Dashboard</title>
      <style>
        :root {
          --primary: #38bdf8;
          --primary-dark: #0284c7;
          --secondary: #a855f7;
          --bg-dark: #0f172a;
          --bg-darker: #0a0f1c;
          --bg-card: #1e293b;
          --text-light: #f8fafc;
          --text-dim: #94a3b8;
          --success: #22c55e;
          --warning: #eab308;
          --error: #ef4444;
          --border: #1e293b;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: var(--bg-dark);
          color: var(--text-light);
          line-height: 1.5;
        }
        
        .container {
          width: 95%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem 0;
        }
        
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }
        
        .logo {
          font-size: 1.5rem;
          font-weight: bold;
        }
        
        .logo span {
          background: linear-gradient(to right, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .stat-card {
          background-color: var(--bg-card);
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card h3 {
          font-size: 0.9rem;
          color: var(--text-dim);
          margin-bottom: 0.5rem;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0 2rem;
          overflow-x: auto;
        }
        
        .card {
          background-color: var(--bg-card);
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .card-title {
          font-size: 1.25rem;
          font-weight: bold;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        
        th {
          background-color: var(--bg-darker);
          font-weight: 500;
          color: var(--text-dim);
        }
        
        tr:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
        
        .status-executed {
          color: var(--success);
          font-weight: 500;
        }
        
        .status-pending {
          color: var(--warning);
          font-weight: 500;
        }
        
        .status-failed {
          color: var(--error);
          font-weight: 500;
        }
        
        .refresh-notice {
          text-align: center;
          color: var(--text-dim);
          margin: 2rem 0;
          font-size: 0.9rem;
        }
        
        .transformers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .transformer-card {
          background-color: var(--bg-card);
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .transformer-name {
          font-size: 1.1rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
          color: var(--primary);
        }
        
        .transformer-status {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          background-color: var(--success);
          color: white;
          margin-bottom: 0.75rem;
        }
        
        .transformer-pairs {
          margin-top: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-dim);
        }
        
        .pair-tag {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          background-color: var(--bg-darker);
          border-radius: 0.25rem;
          margin-right: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
        }
        
        .footer {
          text-align: center;
          padding: 2rem 0;
          color: var(--text-dim);
          border-top: 1px solid var(--border);
          margin-top: 3rem;
        }
        
        @media (max-width: 768px) {
          .container {
            width: 100%;
            padding: 1rem;
          }
          
          header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .status {
            margin-top: 1rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo">Solana <span>Quantum Trading</span> Platform</div>
          <div class="status">System Status: <strong style="color: var(--success);">ONLINE</strong></div>
        </header>
        
        <div class="stats-container">
          <div class="stat-card">
            <h3>Total Signals</h3>
            <div class="stat-value">${signals.length}</div>
          </div>
          <div class="stat-card">
            <h3>Executed Signals</h3>
            <div class="stat-value">${signals.filter(s => s.status === 'EXECUTED').length}</div>
          </div>
          <div class="stat-card">
            <h3>Pending Signals</h3>
            <div class="stat-value">${signals.filter(s => s.status === 'PENDING').length}</div>
          </div>
          <div class="stat-card">
            <h3>Last Updated</h3>
            <div class="stat-value">${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Active Transformers</h2>
          </div>
          <div class="transformers-grid">
            <div class="transformer-card">
              <div class="transformer-name">MicroQHC</div>
              <div class="transformer-status">Active</div>
              <div>Neural confidence: 99.7%</div>
              <div class="transformer-pairs">
                <div class="pair-tag">SOL/USDC</div>
                <div class="pair-tag">BONK/USDC</div>
                <div class="pair-tag">JUP/USDC</div>
              </div>
            </div>
            <div class="transformer-card">
              <div class="transformer-name">MEME Cortex</div>
              <div class="transformer-status">Active</div>
              <div>Neural confidence: 98.2%</div>
              <div class="transformer-pairs">
                <div class="pair-tag">BONK/USDC</div>
                <div class="pair-tag">SOL/USDC</div>
              </div>
            </div>
            <div class="transformer-card">
              <div class="transformer-name">MemeCortexRemix</div>
              <div class="transformer-status">Active</div>
              <div>Neural confidence: 97.9%</div>
              <div class="transformer-pairs">
                <div class="pair-tag">BONK/USDC</div>
                <div class="pair-tag">SOL/USDC</div>
                <div class="pair-tag">MEME/USDC</div>
                <div class="pair-tag">DOGE/USDC</div>
              </div>
            </div>
            <div class="transformer-card">
              <div class="transformer-name">Security</div>
              <div class="transformer-status">Active</div>
              <div>Neural confidence: 99.9%</div>
              <div class="transformer-pairs">
                <div class="pair-tag">SOL/USDC</div>
                <div class="pair-tag">ETH/USDC</div>
                <div class="pair-tag">BTC/USDC</div>
              </div>
            </div>
            <div class="transformer-card">
              <div class="transformer-name">CrossChain</div>
              <div class="transformer-status">Active</div>
              <div>Neural confidence: 98.5%</div>
              <div class="transformer-pairs">
                <div class="pair-tag">SOL/USDC</div>
                <div class="pair-tag">ETH/USDC</div>
                <div class="pair-tag">BTC/USDC</div>
                <div class="pair-tag">SOL/ETH</div>
                <div class="pair-tag">BTC/ETH</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Trading Signals</h2>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Pair</th>
                  <th>Direction</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Tx Signature</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${signalRows}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Active AI Agents</h2>
          </div>
          <div class="transformers-grid">
            <div class="transformer-card">
              <div class="transformer-name">Hyperion Flash Arbitrage Overlord</div>
              <div class="transformer-status">Active</div>
              <div>Focus: cross-DEX flash loans</div>
            </div>
            <div class="transformer-card">
              <div class="transformer-name">Quantum Omega</div>
              <div class="transformer-status">Active</div>
              <div>Focus: MemeCorTeX strategies</div>
            </div>
            <div class="transformer-card">
              <div class="transformer-name">Singularity Cross-Chain Oracle</div>
              <div class="transformer-status">Active</div>
              <div>Focus: cross-chain strategies</div>
            </div>
          </div>
        </div>
        
        <p class="refresh-notice">
          This page auto-refreshes every 30 seconds. Last refresh: ${new Date().toLocaleTimeString()}
        </p>
        
        <meta http-equiv="refresh" content="30">
        
        <div class="footer">
          <p>Solana Quantum Trading Platform</p>
          <p>Wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb</p>
          <p>© 2025 Quantum HitSquad. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}