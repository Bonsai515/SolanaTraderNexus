
/**
 * Hyperion Transformers
 * 
 * Main entry point for all transformer models used in the Hyperion flash loan system.
 */

import microQHC from './microQHC';
import memeCortex from './memeCortex';
import hyperionFlash from './hyperionFlash';
import solanaOptimizer from './solanaOptimizer';

// Export all transformers
export {
  microQHC,
  memeCortex,
  hyperionFlash,
  solanaOptimizer
};

// Integration function
export function integrateAllTransformers(hyperionSystem: any) {
  console.log('Integrating all transformers with Hyperion system');
  
  // Integrate each transformer
  const transformers = [
    microQHC.integrate(hyperionSystem),
    memeCortex.integrate(hyperionSystem),
    hyperionFlash.integrate(hyperionSystem),
    solanaOptimizer.integrate(hyperionSystem)
  ];
  
  return transformers;
}

// Get transformer by name
export function getTransformer(name: string) {
  switch (name) {
    case 'microQHC':
      return microQHC;
    case 'memeCortex':
      return memeCortex;
    case 'hyperionFlash':
      return hyperionFlash;
    case 'solanaOptimizer':
      return solanaOptimizer;
    default:
      throw new Error(`Transformer ${name} not found`);
  }
}
