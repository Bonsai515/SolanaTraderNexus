
#!/bin/bash

# Shell script for executing transactions with Trading Wallet 1
# Public key: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Export private key
export PRIVATE_KEY="b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da"

# Execute the Day 4 strategy with this wallet
npx tsx execute-day4-strategy.ts $@
