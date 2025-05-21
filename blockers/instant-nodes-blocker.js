/**
 * InstantNodes Blocker - Overrides Instant Nodes RPC
 */

// This module blocks any attempt to use Instant Nodes
const originalRequire = require;

// Override the require function to intercept any attempts to load RPC modules
require = function(id) {
  const result = originalRequire(id);
  
  // If this is the RPC connection manager, patch it
  if (id.includes('rpcConnectionManager') || id.includes('RpcConnectionManager')) {
    console.log('[InstantNodes Blocker] Patching RPC Connection Manager');
    
    // Replace Instant Nodes URL with an invalid value to ensure it's never used
    if (typeof result === 'object' && result !== null) {
      // For any property that might contain the RPC URL
      Object.keys(result).forEach(key => {
        if (typeof result[key] === 'string' && 
            result[key].includes('instantnodes')) {
          console.log('[InstantNodes Blocker] Blocked Instant Nodes URL in ' + key);
          result[key] = 'BLOCKED_INSTANT_NODES_URL';
        }
        
        // Check for URL in nested objects
        if (typeof result[key] === 'object' && result[key] !== null) {
          Object.keys(result[key]).forEach(subKey => {
            if (typeof result[key][subKey] === 'string' && 
                result[key][subKey].includes('instantnodes')) {
              console.log('[InstantNodes Blocker] Blocked nested Instant Nodes URL in ' + key + '.' + subKey);
              result[key][subKey] = 'BLOCKED_INSTANT_NODES_URL';
            }
          });
        }
      });
      
      // Patch any initialization functions
      if (typeof result.initialize === 'function') {
        const originalInit = result.initialize;
        result.initialize = function(...args) {
          // Filter out any Instant Nodes URLs from arguments
          const filteredArgs = args.map(arg => {
            if (typeof arg === 'string' && arg.includes('instantnodes')) {
              console.log('[InstantNodes Blocker] Blocked Instant Nodes URL in initialize args');
              return 'BLOCKED_INSTANT_NODES_URL';
            }
            return arg;
          });
          
          return originalInit.apply(this, filteredArgs);
        };
      }
    }
  }
  
  return result;
};

console.log('[InstantNodes Blocker] Activated - All Instant Nodes connections blocked');
