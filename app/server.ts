
import "dotenv/config";
import express from "express";
import multer from "multer";
import userRouter from "./routes/users";
import photoRouter from "./routes/photos";
const upload = multer();
import cors = require('cors');

const corsConfig = {
    origin: "*",
    // origin: "https://enigma-01.github.io",
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}

const app: express.Application = express();

app.use(cors(corsConfig)); // Enable all CORS requests

// Parsing application/json
app.use(express.json({limit: '10mb'}));

// Parsing application/xwww-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '10mb'}));

// Parse multipart/form-data
app.use(upload.none());
app.use(express.static('public')); // static files

// Routes
app.use('/api/users', userRouter);
app.use('/api/photos', photoRouter);

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`REST API server started on port ${PORT}`));
