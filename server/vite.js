const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer: createViteServer } = require('vite');

/**
 * Configure Vite server for development
 * This sets up Vite's dev server middleware to handle client-side requests
 */
async function configureViteServer(app, server) {
  try {
    // Create Vite server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      root: path.join(__dirname, '../client'),
      configFile: path.join(__dirname, '../client/vite.config.js'),
      appType: 'spa'
    });

    // Use vite's connect instance as middleware
    app.use(vite.middlewares);
    
    // Fall back to index.html for SPA routing
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      
      // Skip API routes
      if (url.startsWith('/api') || url.startsWith('/ws')) {
        return next();
      }
      
      try {
        // 1. Read index.html
        let template = fs.readFileSync(
          path.resolve(__dirname, '../client/index.html'),
          'utf-8'
        );

        // 2. Apply Vite HTML transforms
        template = await vite.transformIndexHtml(url, template);
        
        // 3. Send the transformed HTML
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        // If an error is caught, let Vite fix the stacktrace
        vite.ssrFixStacktrace(e);
        console.error(e);
        res.status(500).end(e.message);
      }
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error configuring Vite server:', error);
    
    // Fallback to static file serving if Vite fails to initialize
    console.log('Falling back to static file serving');
    app.use(express.static(path.join(__dirname, '../client')));
    
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      
      res.sendFile(path.join(__dirname, '../client/index.html'));
    });
    
    return Promise.resolve();
  }
}

module.exports = { configureViteServer };