const WebSocket = require('ws');

console.log('Testing WebSocket connection...');

// Create a WebSocket connection
const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', () => {
  console.log('Connection opened');
  ws.send(JSON.stringify({ type: 'TEST', message: 'Hello' }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('error', (error) => {
  console.error('Error:', error);
});

ws.on('close', () => {
  console.log('Connection closed');
});