/**
 * Transfer SOL from Phantom wallet to HPN trading wallet
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Wallet addresses
const PHANTOM_WALLET = "2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH";
const HPN_WALLET = "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK";

// Amount to transfer (in SOL)
const AMOUNT_TO_TRANSFER = 0.5; // Transfer 0.5 SOL

// Connection to Solana network
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

/**
 * Load wallet private keys from private_wallets.json
 */
function loadPrivateKeys() {
  try {
    const walletDataPath = path.join('./data', 'private_wallets.json');
    const walletData = JSON.parse(fs.readFileSync(walletDataPath, 'utf8'));
    
    let phantomKey = null;
    let hpnKey = null;
    
    for (const wallet of walletData) {
      if (wallet.publicKey === PHANTOM_WALLET) {
        phantomKey = wallet.privateKey;
      }
      
      if (wallet.publicKey === HPN_WALLET) {
        hpnKey = wallet.privateKey;
      }
    }
    
    if (!phantomKey) {
      throw new Error(`Could not find private key for Phantom wallet ${PHANTOM_WALLET}`);
    }
    
    return { phantomKey, hpnKey };
  } catch (error) {
    console.error('Error loading private keys:', error.message);
    throw error;
  }
}

/**
 * Create a keypair from a private key
 */
function createKeypairFromPrivateKey(privateKeyStr) {
  try {
    // Check if the key is already in the right format or needs to be converted
    let secretKey;
    if (privateKeyStr.length === 64 || privateKeyStr.length === 128) {
      // Hex format (64 chars) or with spaces (128 chars)
      const cleanKey = privateKeyStr.replace(/\s+/g, '');
      secretKey = Buffer.from(cleanKey, 'hex');
    } else {
      // Assume it's a base58 encoded key
      const bs58 = require('bs58');
      secretKey = bs58.decode(privateKeyStr);
    }
    
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error creating keypair:', error.message);
    throw error;
  }
}

/**
 * Transfer SOL from Phantom wallet to HPN wallet
 */
async function transferSOL() {
  try {
    console.log(`Starting transfer of ${AMOUNT_TO_TRANSFER} SOL from Phantom wallet to HPN wallet...`);
    
    // Load private keys
    const { phantomKey } = loadPrivateKeys();
    
    // Create phantom wallet keypair
    const phantomKeypair = createKeypairFromPrivateKey(phantomKey);
    
    // Get current balances
    const phantomBalance = await connection.getBalance(phantomKeypair.publicKey);
    const phantomBalanceSOL = phantomBalance / LAMPORTS_PER_SOL;
    
    console.log(`Phantom wallet balance: ${phantomBalanceSOL.toFixed(6)} SOL`);
    
    if (phantomBalance < AMOUNT_TO_TRANSFER * LAMPORTS_PER_SOL) {
      throw new Error(`Insufficient balance in Phantom wallet. Required: ${AMOUNT_TO_TRANSFER} SOL, Available: ${phantomBalanceSOL.toFixed(6)} SOL`);
    }
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: phantomKeypair.publicKey,
        toPubkey: new PublicKey(HPN_WALLET),
        lamports: AMOUNT_TO_TRANSFER * LAMPORTS_PER_SOL
      })
    );
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = phantomKeypair.publicKey;
    
    // Sign transaction
    transaction.sign(phantomKeypair);
    
    // Send transaction
    console.log('Sending transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log(`Transaction sent with signature: ${signature}`);
    console.log(`Waiting for confirmation...`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    console.log(`✅ Transaction confirmed! ${AMOUNT_TO_TRANSFER} SOL transferred from Phantom wallet to HPN wallet`);
    
    // Get updated balances
    const updatedPhantomBalance = await connection.getBalance(phantomKeypair.publicKey);
    const updatedPhantomBalanceSOL = updatedPhantomBalance / LAMPORTS_PER_SOL;
    
    const updatedHpnBalance = await connection.getBalance(new PublicKey(HPN_WALLET));
    const updatedHpnBalanceSOL = updatedHpnBalance / LAMPORTS_PER_SOL;
    
    console.log(`Updated Phantom wallet balance: ${updatedPhantomBalanceSOL.toFixed(6)} SOL`);
    console.log(`Updated HPN wallet balance: ${updatedHpnBalanceSOL.toFixed(6)} SOL`);
    
    return signature;
  } catch (error) {
    console.error('Error transferring SOL:', error.message);
    throw error;
  }
}

// Execute the transfer
transferSOL().catch(error => {
  console.error('Failed to execute transfer:', error.message);
});