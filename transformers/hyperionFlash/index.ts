
/**
 * hyperionFlash Transformer
 * 
 * Main entry point for the hyperionFlash transformer model.
 */

import { createModel, optimizeRoute } from './architecture';
import { trainModel } from './training';
import { integrate } from './integration';

export default {
  name: 'hyperionFlash',
  type: 'hybrid',
  version: '1.0.0',
  createModel,
  optimizeRoute,
  trainModel,
  integrate
};
