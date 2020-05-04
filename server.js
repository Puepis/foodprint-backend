
const express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();

// Create express app
const app = express()

// Parsing application/json
app.use(bodyParser.json());

// Parsing application/xwww-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Parse multipart/form-data
app.use(upload.array());
app.use(express.static('public')); // static files

// Enable CORS for all resources
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Routes
app.use('/api/users', require('./app/routes/api/users'));

// Test endpoint - not needed
app.use('/api/test', require('./app/routes/api/test'));

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`REST API server started on port ${PORT}`));
