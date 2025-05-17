
#!/bin/bash

# Shell script for executing transactions with Prophet Wallet
# Public key: 5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG

# Export private key
export PRIVATE_KEY="d28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787"

# Execute the Day 4 strategy with this wallet
npx tsx execute-day4-strategy.ts $@
