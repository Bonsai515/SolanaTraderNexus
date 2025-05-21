/**
 * Direct Connection to Syndica Premium
 * For use with your premium API key
 */

import { Connection, PublicKey } from '@solana/web3.js';

// Direct connection to premium Syndica
const connection = new Connection('https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc', {
  commitment: 'confirmed',
  wsEndpoint: 'wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk',
  confirmTransactionInitialTimeout: 60000
});

export { connection };
export default connection;
