const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * Configure Vite server for development
 * This is a simplified implementation to allow the server to work without Vite
 * We redirect all non-API requests to the client's static files
 */
function configureViteServer(app, server) {
  return new Promise((resolve) => {
    // Serve static files from client directory
    app.use(express.static(path.join(__dirname, '../client')));
    
    // Fall back to index.html for SPA routing
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      
      res.sendFile(path.join(__dirname, '../client/index.html'));
    });
    
    resolve();
  });
}

module.exports = { configureViteServer };