
const express = require('express');

// Create express app
const app = express()
app.use(express.json());

// Bodyparser
app.use(express.urlencoded({extended: false}));

// Routes
app.use('/api/users', require('./app/routes/api/users'));
app.use('/api/photos', require('./app/routes/api/photos'));

// Test endpoint - not needed
app.use('/api/test', require('./app/routes/api/test'));

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`REST API server started on port ${PORT}`));
