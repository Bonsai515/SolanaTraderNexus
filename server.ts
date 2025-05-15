/**
 * Quantum HitSquad Nexus Professional - Server Entry Point
 * 
 * This is the main server file that handles API routes and serves the application
 * for deployment on cloud platforms.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { registerRoutes } from './server/routes';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, 'client')));

// Register API routes
const server = registerRoutes(app);

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log('Quantum HitSquad Nexus Professional Engine activated');
  console.log('All transformers initialized with neural-quantum entanglement');
});