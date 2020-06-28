"use strict";
/*
 * Here we define the logic for our user controller
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editPhoto = exports.deletePhoto = exports.savePhoto = exports.retrieveFoodprint = exports.retrievePhotos = void 0;
const connection = require("../config/dbConnection");
const aws = require("../config/aws");
let S3_BUCKET = process.env.S3_BUCKET_NAME;
const s3 = new aws.S3(); // service object
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function uploadImageToS3(path, imageData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof S3_BUCKET === "string") {
            let uploadParams = {
                Bucket: S3_BUCKET,
                Key: path,
                Body: imageData
            };
            try {
                yield s3.upload(uploadParams).promise(); // upload image
                return true;
            }
            catch (e) {
                console.log("Error uploading the image", e);
            }
        }
        return false;
    });
}
function getPhotoDataFromS3(path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof S3_BUCKET === "string") {
            try {
                const fetchParams = {
                    Bucket: S3_BUCKET,
                    Key: path
                };
                const data = yield s3.getObject(fetchParams).promise();
                if (typeof data.Body !== "undefined") { // Image data retrieved
                    return data.Body.toString('binary');
                }
                return null;
            }
            catch (e) {
                console.log("Error retrieving file", e);
            }
        }
        return null; // error
    });
}
function deletePhotoFromS3(path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof S3_BUCKET === "string") {
            try {
                const params = {
                    Bucket: S3_BUCKET,
                    Key: path
                };
                yield s3.deleteObject(params).promise();
                return true;
            }
            catch (e) {
                console.log("Error deleting file", e);
            }
        }
        return false;
    });
}
// Get a list of all user photos, sorted by restaurant
function retrievePhotos(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const photoQuery = "SELECT r.id restaurant_id, r.name restaurant_name, r.rating restaurant_rating, r.lat restaurant_lat, \
        r.lng restaurant_lng, p.path, p.photo_name, p.price, p.comments, p.time_taken FROM restaurants r INNER JOIN \
        photos p ON r.id = p.restaurant_id WHERE p.user_id = $1 ORDER BY r.name";
        try {
            const result = yield connection.query(photoQuery, [id]);
            const rows = result.rows;
            for (let photo of rows) {
                photo.data = yield getPhotoDataFromS3(photo.path); // photo data
            }
            return rows;
        }
        catch (e) {
            console.log(e);
            return null;
        }
    });
}
exports.retrievePhotos = retrievePhotos;
// Sort photos by restaurant 
function retrieveFoodprint(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const restaurantQuery = "SELECT id restaurant_id, name restaurant_name, rating restaurant_rating, \
        lat restaurant_lat, lng restaurant_lng FROM restaurants r WHERE id IN ( \
        SELECT DISTINCT restaurant_id FROM photos WHERE user_id = $1 \
        ) ORDER BY r.name";
        const photoQuery = "SELECT path, photo_name, price, comments, time_taken FROM photos WHERE restaurant_id = $1 AND user_id = $2";
        try {
            const restaurants = (yield connection.query(restaurantQuery, [id])).rows;
            for (let r of restaurants) {
                let photos = (yield connection.query(photoQuery, [r.restaurant_id, id])).rows;
                for (let p of photos) {
                    p.data = yield getPhotoDataFromS3(p.path);
                }
                r.photos = photos;
            }
            return restaurants;
        }
        catch (e) {
            console.log(e);
            return null;
        }
    });
}
exports.retrieveFoodprint = retrieveFoodprint;
function savePhoto(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user_id = req.body.userId;
        const { path, data, details, location } = req.body.image;
        // Store image data in S3 Bucket
        const uploaded = yield uploadImageToS3(path, data);
        if (uploaded) {
            try {
                // 1. Check if restaurant exists in restaurant table, if not then insert
                const saved_restaurants = (yield connection.query("SELECT name FROM restaurants WHERE id = $1", [location.id])).rows;
                if (saved_restaurants.length == 0) {
                    yield connection.query("INSERT INTO restaurants (id, name, rating, lat, lng) \
                    VALUES ($1, $2, $3, $4, $5)", [location.id, location.name, location.rating, location.lat,
                        location.lng]);
                }
                // 2. Store image details in pgsql table
                yield connection.query("INSERT INTO photos (path, user_id, photo_name, price, comments, restaurant_id, time_taken) \
                VALUES ($1, $2, $3, $4, $5, $6, $7)", [path, user_id, details.name, details.price, details.comments,
                    location.id, details.timestamp]);
            }
            catch (e) {
                console.log(e);
                res.status(401).send(e);
            }
            // Successful
            res.sendStatus(200);
        }
        else {
            res.status(401).send("Error uploading image to S3");
        }
    });
}
exports.savePhoto = savePhoto;
;
// Delete a photo from the db and S3 
function deletePhoto(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = req.headers['photo_path'];
        // First remove photo from S3, then remove table row
        const successful = yield deletePhotoFromS3(path);
        if (successful) {
            try {
                yield connection.query("DELETE FROM photos WHERE path = $1", [path]);
                res.sendStatus(200);
            }
            catch (e) {
                console.log(e);
                res.sendStatus(401);
            }
        }
        else {
            res.sendStatus(401);
        }
    });
}
exports.deletePhoto = deletePhoto;
;
function editPhoto(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, photo_name, price, comments } = req.body;
        try {
            yield connection.query("UPDATE photos SET photo_name = $1, price = $2, comments = $3 WHERE path = $4", [photo_name, price, comments, path]);
            res.sendStatus(200);
        }
        catch (e) {
            console.log(e);
            res.sendStatus(401);
        }
    });
}
exports.editPhoto = editPhoto;
;
