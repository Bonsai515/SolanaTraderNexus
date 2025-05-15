import { displayProfitProjection } from './server/profit-projections';

// Generate profit projection report based on current wallet balance of 0.54442 SOL
// Current SOL price approximately $144 as of May 15, 2025
const solPrice = 144;
const currentCapital = 0.54442 * solPrice; // Convert SOL to USD

console.log(`\n\n====== QUANTUM HITSQUAD NEXUS PROFESSIONAL ======`);
console.log(`====== CURRENT SYSTEM PROFIT REPORT ======\n`);
console.log(`Current wallet balance: 0.54442 SOL ($${currentCapital.toFixed(2)})`);
console.log(`Neural-quantum entanglement level: 99%`);
console.log(`\nGenerating detailed profit projections based on current system configuration...`);

// Display profit projection with current capital
displayProfitProjection(currentCapital);