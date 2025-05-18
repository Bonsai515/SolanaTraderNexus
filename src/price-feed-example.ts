/**
 * Example usage of the improved price feed integration
 */

import { getTokenPrice, getTokenPrices, initializePriceFeeds, getPriceSourcesStatus } from './price-feed-integration';

// Initialize price feeds
initializePriceFeeds();

// Example of checking price sources status
async function checkSourceStatus() {
  const status = getPriceSourcesStatus();
  console.log('\nPrice Sources Status:');
  console.log(JSON.stringify(status, null, 2));
}

// Example of getting a single token price
async function getSingleTokenPrice() {
  console.log('\nGetting SOL price...');
  const solPrice = await getTokenPrice('SOL');
  console.log('SOL Price:', solPrice);
}

// Example of getting multiple token prices
async function getMultipleTokenPrices() {
  console.log('\nGetting multiple token prices...');
  const tokens = ['SOL', 'BONK', 'JUP', 'PYTH'];
  const prices = await getTokenPrices(tokens);
  
  console.log('Token Prices:');
  for (const [token, price] of Object.entries(prices)) {
    console.log(`${token}: ${price ? `${price.price} USD (source: ${price.source}, confidence: ${price.confidence})` : 'Not available'}`);
  }
}

// Run the examples
async function runExamples() {
  try {
    await checkSourceStatus();
    await getSingleTokenPrice();
    await getMultipleTokenPrices();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

runExamples();