
#!/bin/bash
# RPC Monitor Script

echo "=== RPC MONITOR ==="
echo "Monitoring RPC requests and rate limits..."

# Create log directory
mkdir -p ./logs

# Monitor RPC cache directory
watch -n 5 "ls -la ./data/rpc_cache | wc -l && echo 'Cache entries: ' && ls -la ./data/rpc_cache | head -n 10"
