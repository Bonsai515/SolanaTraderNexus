import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';

const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';

/**
 * Tests the Syndica RPC connection using header-based authentication
 */
export async function testSyndicaConnection(): Promise<boolean> {
  console.log('Testing Syndica RPC connection...');

  try {
    // Create fetch request options with the API key in headers
    const requestOptions = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': SYNDICA_API_KEY 
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBlockHeight',
        params: []
      })
    };

    // Make direct fetch request to test API key
    const response = await fetch(SYNDICA_URL, requestOptions);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Syndica API error: ${JSON.stringify(data.error)}`);
    }
    
    const blockHeight = data.result;
    console.log(`✅ Syndica connection successful! Current block height: ${blockHeight}`);

    // Also test getting a recent blockhash
    const blockhashRequest = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': SYNDICA_API_KEY 
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestBlockhash',
        params: []
      })
    };

    const blockhashResponse = await fetch(SYNDICA_URL, blockhashRequest);
    const blockhashData = await blockhashResponse.json();
    console.log(`✅ Got recent blockhash: ${blockhashData.result?.value?.blockhash || 'unknown'}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Syndica RPC:', error);
    return false;
  }
}

/**
 * Gets a Syndica connection with the appropriate headers
 */
export function getSyndicaConnection(commitmentLevel: Commitment = 'confirmed'): Connection {
  // Create connection config with correct commitment
  const config: ConnectionConfig = {
    commitment: commitmentLevel,
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
    httpHeaders: {
      'X-API-Key': SYNDICA_API_KEY
    }
  };
  
  return new Connection(SYNDICA_URL, config);
}