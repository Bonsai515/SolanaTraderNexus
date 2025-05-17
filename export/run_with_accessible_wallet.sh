
#!/bin/bash

# Shell script for executing transactions with Accessible Wallet
# Public key: 4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC

# Export private key
export PRIVATE_KEY="793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f"

# Execute the Day 4 strategy with this wallet
npx tsx execute-day4-strategy.ts $@
