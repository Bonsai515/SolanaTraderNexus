import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

// Create a connection to the Solana network
export const getSolanaConnection = (endpoint?: string) => {
  const defaultEndpoint = 'https://api.mainnet-beta.solana.com';
  return new Connection(endpoint || defaultEndpoint);
};

// Get balance for a wallet
export const getWalletBalance = async (walletAddress: string, connection: Connection) => {
  const publicKey = new PublicKey(walletAddress);
  const balance = await connection.getBalance(publicKey);
  return balance / 1000000000; // Convert lamports to SOL
};

// Create a simple transfer transaction
export const createTransferTransaction = async (
  senderPublicKey: PublicKey,
  recipientAddress: string,
  amount: number, // in SOL
  connection: Connection
) => {
  const recipientPublicKey = new PublicKey(recipientAddress);
  const lamports = amount * 1000000000; // Convert SOL to lamports

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderPublicKey,
      toPubkey: recipientPublicKey,
      lamports,
    })
  );

  // Get the recent blockhash to include in the transaction
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = senderPublicKey;

  return transaction;
};

// Helper to format SOL amounts
export const formatSolAmount = (amount: number) => {
  return `${amount.toFixed(2)} SOL`;
};

// Helper to shorten wallet addresses for display
export const shortenAddress = (address: string, chars = 4) => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};
