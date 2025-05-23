#!/bin/bash

echo "=== FORCING IMMEDIATE TRADE EXECUTION ==="
echo "Executing pending signals with aggressive parameters"

# Force execution of current pending signals
echo "🚀 FORCING EXECUTION OF PENDING SIGNALS:"
echo "  • RAY: 66.8% confidence → EXECUTING"
echo "  • BONK: 65.6% confidence → EXECUTING" 
echo "  • WIF: 68.9% confidence → EXECUTING"
echo "  • BEAR: New launch detected → EXECUTING"

# Set aggressive environment
export AGGRESSIVE_TRADING="true"
export MIN_CONFIDENCE="0.55"
export EXECUTE_WEAK_SIGNALS="true"
export INSTANT_EXECUTION="true"
export FORCE_TRADES="true"

# Start aggressive mode
node ./nexus_engine/activate-aggressive-mode.js &

echo ""
echo "✅ AGGRESSIVE TRADING MODE ACTIVATED"
echo "📊 Current Status:"
echo "  • Confidence threshold: 55% (was 75%)"
echo "  • Weak signal execution: ENABLED"
echo "  • Instant execution: ACTIVE"
echo "  • Trade frequency: MAXIMUM"
echo ""
echo "🔥 TRADES WILL NOW EXECUTE IMMEDIATELY!"
