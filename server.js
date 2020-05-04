
const express = require('express');

// Create express app
const app = express()
app.use(express.json());

// Bodyparser
app.use(express.urlencoded({extended: false}));

// Enable CORS for all resources
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Routes
app.use('/api/users', require('./app/routes/api/users'));
app.use('/api/photos', require('./app/routes/api/photos'));

// Test endpoint - not needed
app.use('/api/test', require('./app/routes/api/test'));

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`REST API server started on port ${PORT}`));
