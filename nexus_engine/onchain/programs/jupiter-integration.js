/**
 * Jupiter On-Chain Integration
 * Real transaction execution through Jupiter Aggregator
 */

const { Connection, PublicKey, Transaction, VersionedTransaction } = require('@solana/web3.js');

class JupiterOnChainIntegration {
  constructor() {
    this.programId = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
    this.connection = new Connection('https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc');
    this.quoteAPI = 'https://quote-api.jup.ag/v6';
    this.swapAPI = 'https://quote-api.jup.ag/v6/swap';
  }

  async getSwapQuote(inputMint, outputMint, amount, slippageBps = 50) {
    try {
      console.log(`[Jupiter] Getting quote: ${amount} ${inputMint} -> ${outputMint}`);
      
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false'
      });

      const response = await fetch(`${this.quoteAPI}/quote?${params}`);
      const quote = await response.json();
      
      if (quote.error) {
        throw new Error(`Jupiter quote error: ${quote.error}`);
      }
      
      return quote;
    } catch (error) {
      console.error('[Jupiter] Quote error:', error.message);
      throw error;
    }
  }

  async executeSwap(quote, userPublicKey) {
    try {
      console.log('[Jupiter] Executing real on-chain swap...');
      
      const swapResponse = await fetch(this.swapAPI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: userPublicKey.toString(),
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          feeAccount: null,
          trackingAccount: null,
          computeUnitPriceMicroLamports: 15000,
          dynamicComputeUnitLimit: true,
          skipUserAccountsRpcCalls: true
        })
      });

      const swapTransaction = await swapResponse.json();
      
      if (swapTransaction.error) {
        throw new Error(`Jupiter swap error: ${swapTransaction.error}`);
      }

      return swapTransaction;
    } catch (error) {
      console.error('[Jupiter] Swap execution error:', error.message);
      throw error;
    }
  }

  async submitAndConfirmTransaction(serializedTransaction, userKeypair) {
    try {
      // Deserialize the transaction
      const transaction = VersionedTransaction.deserialize(Buffer.from(serializedTransaction, 'base64'));
      
      // Sign the transaction
      transaction.sign([userKeypair]);
      
      console.log('[Jupiter] Submitting transaction to blockchain...');
      
      // Submit transaction
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 5
      });
      
      console.log(`[Jupiter] Transaction submitted: ${signature}`);
      
      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.message.recentBlockhash,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log(`[Jupiter] Transaction confirmed: ${signature}`);
      return {
        signature,
        confirmed: true,
        slot: confirmation.context.slot
      };
      
    } catch (error) {
      console.error('[Jupiter] Transaction submission error:', error.message);
      throw error;
    }
  }
}

module.exports = JupiterOnChainIntegration;
