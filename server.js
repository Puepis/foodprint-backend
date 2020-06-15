
const express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
var cors = require('cors');

var corsConfig = {
    origin: false,
    // origin: "https://enigma-01.github.io",
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept']
}

// Create express app
const app = express()

app.use(cors(corsConfig)); // Enable all CORS requests

// Parsing application/json
app.use(express.json({extended: true, limit: '10mb'}));

// Parsing application/xwww-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '10mb'}));

// Parse multipart/form-data
app.use(upload.array());
app.use(express.static('public')); // static files

// Routes
app.use('/api/users', require('./app/routes/api/users'));
app.use('/api/photos', require('./app/routes/api/photos'));

// Test endpoint - not needed
app.use('/', require('./app/routes/api/test'));

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`REST API server started on port ${PORT}`));
