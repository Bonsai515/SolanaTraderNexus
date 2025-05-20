/**
 * Rate Limit Fix Test
 * 
 * This script tests the rate limit fix implementation.
 */

import { 
  getBalance, 
  getAccountInfo, 
  getRecentBlockhash, 
  getConnectionStats 
} from './utils/rpc-manager';
import { PublicKey } from '@solana/web3.js';

const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Test the rate limit fix
async function testRateLimitFix() {
  console.log('Testing rate limit fix implementation...');
  
  try {
    // Get initial stats
    const initialStats = getConnectionStats();
    console.log('Initial cache stats:', initialStats.cacheStats);
    
    // Test 1: Make multiple requests for the same data to test caching
    console.log('\nTest 1: Testing cache with repeated requests');
    console.time('First request');
    const balance1 = await getBalance(MAIN_WALLET_ADDRESS);
    console.timeEnd('First request');
    console.log(`Main wallet balance: ${balance1 / 1_000_000_000} SOL`);
    
    console.time('Second request (should be cached)');
    const balance2 = await getBalance(MAIN_WALLET_ADDRESS);
    console.timeEnd('Second request (should be cached)');
    console.log(`Main wallet balance (cached): ${balance2 / 1_000_000_000} SOL`);
    
    // Test 2: Make multiple unique requests to test throttling
    console.log('\nTest 2: Testing throttling with multiple requests');
    console.log('Making 10 different account requests in parallel...');
    
    const addresses = [
      'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      '11111111111111111111111111111111',
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      'J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix',
      'CKaKtYvz6dKPyMvYq9Rh3UBrnNqYZAyd7iF4jX1tJZP1'
    ];
    
    console.time('10 parallel requests');
    const results = await Promise.all(addresses.map(addr => getBalance(addr)));
    console.timeEnd('10 parallel requests');
    
    // Display results
    addresses.forEach((addr, i) => {
      console.log(`Balance of ${addr.substring(0, 6)}...: ${results[i] / 1_000_000_000} SOL`);
    });
    
    // Get final stats
    const finalStats = getConnectionStats();
    console.log('\nFinal cache stats:', finalStats.cacheStats);
    console.log('Connection stats:', finalStats.connections);
    
    console.log('\nRate limit fix test completed successfully!');
  } catch (error) {
    console.error('Error in rate limit fix test:', error);
  }
}

// Run the test
testRateLimitFix();