const WebSocket = require('ws');

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:5000/ws');

// Connection opened
ws.on('open', function() {
    console.log('Connected to WebSocket server');
    
    // Send a ping message
    ws.send(JSON.stringify({
        type: 'PING',
        timestamp: new Date().toISOString()
    }));
});

// Listen for messages
ws.on('message', function(data) {
    console.log('Message from server:', data.toString());
    
    // Close the connection after receiving a response
    ws.close();
});

// Handle connection close
ws.on('close', function() {
    console.log('Connection closed');
    process.exit(0);
});

// Handle errors
ws.on('error', function(error) {
    console.error('WebSocket error:', error);
    process.exit(1);
});

// Set a timeout to exit if no response is received
setTimeout(() => {
    console.error('Timeout: No response received from server');
    process.exit(1);
}, 5000);
