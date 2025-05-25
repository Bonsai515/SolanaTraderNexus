/**
 * Conversation Memory Manager
 * 
 * Manages state machine memory for tracking user requests,
 * wallet states, strategy preferences, and conversation context.
 */

import { storage } from './server/storage';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
const MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');

class ConversationMemoryManager {
  private sessionId: string;
  private userId: string;

  constructor(sessionId: string = 'main_session', userId: string = 'user_1') {
    this.sessionId = sessionId;
    this.userId = userId;
  }

  public async initializeMemory(): Promise<void> {
    console.log('🧠 INITIALIZING CONVERSATION MEMORY');
    console.log('='.repeat(40));

    try {
      await this.loadOrCreateConversation();
      await this.updateCurrentWalletStates();
      await this.recordCurrentRequest();
      await this.displayMemoryStatus();
    } catch (error) {
      console.log('❌ Memory initialization error: ' + error.message);
    }
  }

  private async loadOrCreateConversation(): Promise<void> {
    let conversation = await storage.getConversation(this.sessionId);
    
    if (!conversation) {
      console.log('📝 Creating new conversation memory...');
      conversation = await storage.createConversation({
        sessionId: this.sessionId,
        userId: this.userId,
        context: {
          wallets: [
            'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
            'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia'
          ],
          mainGoal: '2+ SOL profit via multi-protocol flash loans',
          preferredProtocols: ['MarginFi', 'Marinade', 'Solend'],
          riskLevel: 'MEDIUM',
          lastActivity: 'dual-wallet strategy planning'
        }
      });
      console.log('✅ New conversation created');
    } else {
      console.log('✅ Existing conversation loaded');
    }
  }

  private async updateCurrentWalletStates(): Promise<void> {
    console.log('💰 Updating wallet states...');
    
    // Update main wallet
    const mainWallet = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
    const balance1 = await connection.getBalance(new PublicKey(mainWallet));
    const solBalance1 = balance1 / LAMPORTS_PER_SOL;
    
    // Check mSOL balance
    const msolAccount = await getAssociatedTokenAddress(MSOL_MINT, new PublicKey(mainWallet));
    let msolBalance = 0;
    try {
      const msolInfo = await connection.getTokenAccountBalance(msolAccount);
      msolBalance = msolInfo.value.uiAmount || 0;
    } catch (error) {
      // No mSOL account
    }
    
    await storage.updateWalletState({
      sessionId: this.sessionId,
      walletAddress: mainWallet,
      solBalance: solBalance1.toString(),
      msolBalance: msolBalance.toString(),
      totalValue: (solBalance1 + msolBalance * 1.02).toString()
    });
    
    // Update flash loan wallet
    const flashWallet = 'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia';
    const balance2 = await connection.getBalance(new PublicKey(flashWallet));
    const solBalance2 = balance2 / LAMPORTS_PER_SOL;
    
    await storage.updateWalletState({
      sessionId: this.sessionId,
      walletAddress: flashWallet,
      solBalance: solBalance2.toString(),
      msolBalance: '0',
      totalValue: solBalance2.toString()
    });
    
    console.log('✅ Wallet states updated');
  }

  private async recordCurrentRequest(): Promise<void> {
    console.log('📋 Recording current request...');
    
    await storage.addUserRequest({
      sessionId: this.sessionId,
      requestType: 'dual_wallet_flash_loan_strategy',
      requestData: {
        targetProfit: '2.0',
        protocols: ['MarginFi', 'Marinade', 'Solend'],
        wallets: [
          'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
          'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia'
        ],
        strategyType: 'leveraged_multi_protocol',
        timestamp: new Date().toISOString()
      },
      status: 'planning',
      priority: 1
    });
    
    // Save strategy preference
    await storage.saveStrategyPreference({
      sessionId: this.sessionId,
      strategyType: 'dual_wallet_flash_loan',
      targetProfit: '2.0',
      riskLevel: 'MEDIUM',
      protocols: ['MarginFi', 'Marinade', 'Solend'],
      isActive: true
    });
    
    console.log('✅ Current request recorded');
  }

  private async displayMemoryStatus(): Promise<void> {
    console.log('');
    console.log('🎯 MEMORY STATUS:');
    
    // Get recent requests
    const requests = await storage.getUserRequests(this.sessionId);
    console.log(`Recent Requests: ${requests.length}`);
    
    // Get wallet states
    const wallet1State = await storage.getWalletState(this.sessionId, 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK');
    const wallet2State = await storage.getWalletState(this.sessionId, 'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia');
    
    if (wallet1State) {
      console.log(`Main Wallet: ${wallet1State.solBalance} SOL + ${wallet1State.msolBalance} mSOL`);
    }
    if (wallet2State) {
      console.log(`Flash Wallet: ${wallet2State.solBalance} SOL`);
    }
    
    // Get active strategies
    const strategies = await storage.getActiveStrategies(this.sessionId);
    console.log(`Active Strategies: ${strategies.length}`);
    
    // Get trade history
    const trades = await storage.getTradeHistory(this.sessionId);
    console.log(`Trade History: ${trades.length} executions`);
    
    console.log('');
    console.log('🧠 MEMORY CAPABILITIES NOW ACTIVE:');
    console.log('✅ I can remember your requests across conversations');
    console.log('✅ I track your wallet balances and changes');
    console.log('✅ I remember your strategy preferences');
    console.log('✅ I maintain trade execution history');
    console.log('✅ I understand your goal: 2+ SOL profit via dual-wallet strategy');
    
    console.log('');
    console.log('🚀 READY TO CONTINUE:');
    console.log('Your request for dual-wallet flash loan strategy is remembered!');
    console.log('I can now build upon our previous discussions and maintain context.');
  }

  public async getConversationContext(): Promise<any> {
    const conversation = await storage.getConversation(this.sessionId);
    return conversation?.context || {};
  }

  public async updateConversationContext(newContext: any): Promise<void> {
    const currentContext = await this.getConversationContext();
    const mergedContext = { ...currentContext, ...newContext };
    await storage.updateConversation(this.sessionId, mergedContext);
  }
}

async function main(): Promise<void> {
  const memoryManager = new ConversationMemoryManager();
  await memoryManager.initializeMemory();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { ConversationMemoryManager };