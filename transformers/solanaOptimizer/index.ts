
/**
 * solanaOptimizer Transformer
 * 
 * Main entry point for the solanaOptimizer transformer model.
 */

import { createModel, optimizeRoute } from './architecture';
import { trainModel } from './training';
import { integrate } from './integration';

export default {
  name: 'solanaOptimizer',
  type: 'recurrent',
  version: '1.0.0',
  createModel,
  optimizeRoute,
  trainModel,
  integrate
};
