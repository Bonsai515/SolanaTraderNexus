/**
 * Disable CoinGecko API Integration
 * 
 * This script disables CoinGecko API calls to avoid rate limiting issues
 * and configures the system to use alternative price sources.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from './logger';

/**
 * Disable CoinGecko price fetching and replace with Jupiter data
 */
function disableCoinGeckoPriceFetch(): boolean {
  try {
    const apiManagerPath = path.join(__dirname, 'lib', 'externalApiManager.ts');
    
    if (!fs.existsSync(apiManagerPath)) {
      logger.error(`API manager file not found at ${apiManagerPath}`);
      return false;
    }
    
    let content = fs.readFileSync(apiManagerPath, 'utf8');
    
    // Replace the CoinGecko fetch function with a stub that always returns false
    if (content.includes('fetchCoinGeckoPrices')) {
      content = content.replace(
        /export async function fetchCoinGeckoPrices\([^{]*{[\s\S]*?return result;[\s\S]*?}/g,
        `export async function fetchCoinGeckoPrices() {
  logger.info("CoinGecko API disabled to prevent rate limiting");
  return { success: false, data: {} };
}`
      );
      
      fs.writeFileSync(apiManagerPath, content);
      logger.info('✅ Successfully disabled CoinGecko API integration');
      return true;
    } else {
      logger.warn('CoinGecko fetch function not found in API manager');
      return false;
    }
  } catch (error) {
    logger.error(`Error disabling CoinGecko: ${error.message}`);
    return false;
  }
}

/**
 * Configure price distributor to prioritize Jupiter and DEX data
 */
function updatePriceDistributor(): boolean {
  try {
    const priceDistributorPath = path.join(__dirname, 'transformers', 'memecoin-price-distributor.ts');
    
    if (!fs.existsSync(priceDistributorPath)) {
      logger.error(`Price distributor file not found at ${priceDistributorPath}`);
      return false;
    }
    
    let content = fs.readFileSync(priceDistributorPath, 'utf8');
    
    // Modify the price source priorities to skip CoinGecko
    if (content.includes('fetchCoinGeckoPrices')) {
      // Modify the update sequence to skip CoinGecko or reduce its priority
      content = content.replace(
        /const coinGeckoResult = await fetchCoinGeckoPrices\(\);/g,
        `// Skipping CoinGecko to avoid rate limiting
        const coinGeckoResult = { success: false, data: {} };`
      );
      
      fs.writeFileSync(priceDistributorPath, content);
      logger.info('✅ Successfully updated price distributor to skip CoinGecko');
      return true;
    } else {
      logger.warn('CoinGecko integration not found in price distributor');
      return false;
    }
  } catch (error) {
    logger.error(`Error updating price distributor: ${error.message}`);
    return false;
  }
}

/**
 * Main function to disable CoinGecko
 */
export async function disableCoinGecko(): Promise<boolean> {
  logger.info('Disabling CoinGecko API integration...');
  
  // Disable CoinGecko price fetching
  const fetchDisabled = disableCoinGeckoPriceFetch();
  
  // Update price distributor to prioritize other sources
  const distributorUpdated = updatePriceDistributor();
  
  return fetchDisabled || distributorUpdated;
}

// Run if called directly
if (require.main === module) {
  disableCoinGecko()
    .then(success => {
      if (success) {
        console.log('✅ Successfully disabled CoinGecko API integration');
      } else {
        console.log('❌ Failed to disable CoinGecko API integration');
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
    });
}