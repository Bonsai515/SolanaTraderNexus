// Script to check wallet balances
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PROPHET_WALLET = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';

async function checkBalances() {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log('CHECKING WALLET BALANCES:');
    
    // Check Phantom wallet
    const phantomPubkey = new PublicKey(PHANTOM_WALLET);
    const phantomBalance = await connection.getBalance(phantomPubkey);
    console.log(`Phantom wallet: ${(phantomBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    
    // Check HPN wallet
    const hpnPubkey = new PublicKey(HPN_WALLET);
    const hpnBalance = await connection.getBalance(hpnPubkey);
    console.log(`HPN wallet: ${(hpnBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    
    // Check Prophet wallet
    const prophetPubkey = new PublicKey(PROPHET_WALLET);
    const prophetBalance = await connection.getBalance(prophetPubkey);
    console.log(`Prophet wallet: ${(prophetBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

checkBalances();
