const express = require('express');
const path = require('path');
const app = express();

// Serve static files (CSS, JS, images)
app.use(express.static(__dirname));

// Serve our standalone HTML file at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen on the port Replit expects or fallback to 3000
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});