const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// RPC Endpoint - using public endpoint for checking
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Wallets to check
const wallets = [
  {
    name: "Trading Wallet 1 (HPN)",
    address: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
  },
  {
    name: "Phantom Wallet",
    address: "2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH"
  },
  {
    name: "Trading Wallet 2",
    address: "HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR"
  },
  {
    name: "Prophet Wallet",
    address: "5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG"
  }
];

async function checkBalances() {
  console.log("Checking wallet balances...\n");
  
  for (const wallet of wallets) {
    try {
      const publicKey = new PublicKey(wallet.address);
      const balance = await connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`${wallet.name}: ${solBalance.toFixed(6)} SOL`);
    } catch (error) {
      console.error(`Error checking ${wallet.name}:`, error.message);
    }
  }
}

checkBalances().catch(err => console.error("Error:", err));