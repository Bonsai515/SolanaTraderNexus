
/**
 * microQHC Transformer
 * 
 * Main entry point for the microQHC transformer model.
 */

import { createModel, optimizeRoute } from './architecture';
import { trainModel } from './training';
import { integrate } from './integration';

export default {
  name: 'microQHC',
  type: 'attention',
  version: '1.0.0',
  createModel,
  optimizeRoute,
  trainModel,
  integrate
};
