"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
var upload = multer_1.default();
const cors = require("cors");
var corsConfig = {
    origin: "*",
    // origin: "https://enigma-01.github.io",
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
};
// Create express app
const app = express_1.default();
app.use(cors(corsConfig)); // Enable all CORS requests
// Parsing application/json
app.use(express_1.default.json({ limit: '10mb' }));
// Parsing application/xwww-form-urlencoded
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Parse multipart/form-data
app.use(upload.none());
app.use(express_1.default.static('public')); // static files
// Routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/photos', require('./routes/api/photos'));
// Test endpoint - not needed
app.use('/', require('./routes/api/test'));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`REST API server started on port ${PORT}`));
