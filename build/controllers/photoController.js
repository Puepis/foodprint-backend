"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFavourite = exports.editPhoto = exports.deletePhoto = exports.savePhoto = exports.retrieveFoodprint = void 0;
const connection = require("../config/dbConnection");
const storage_1 = require("../image_storage/storage");
// Organize all user photos based on restaurant
exports.retrieveFoodprint = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const restaurantQuery = "SELECT DISTINCT place_id FROM photos WHERE user_id = $1";
    const photoQuery = "SELECT path, url, photo_name, price, comments, time_taken, favourite FROM photos \
        WHERE place_id = $1 AND user_id = $2";
    try {
        const restaurants = (yield connection.query(restaurantQuery, [id])).rows;
        return yield Promise.all(restaurants.map((restaurant) => __awaiter(void 0, void 0, void 0, function* () {
            const photos = (yield connection.query(photoQuery, [restaurant.place_id, id])).rows;
            return Object.assign(Object.assign({}, restaurant), { photos: photos });
        })));
    }
    catch (e) {
        console.error("RETRIEVING FOODPRINT ERROR: ", e);
        return null;
    }
});
// Save photo on server
exports.savePhoto = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user_id = req.body.userId;
    const { path, favourite, details, place_id, data } = req.body.image;
    const imgData = storage_1.parseImageData(data);
    // Store image data in S3 Bucket
    const url = yield storage_1.uploadImageToS3(path, imgData);
    if (url) {
        try {
            yield connection.query("INSERT INTO photos (path, url, user_id, photo_name, price, comments, \
          place_id, time_taken, favourite) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
                path,
                url,
                user_id,
                details.name,
                details.price,
                details.comments,
                place_id,
                details.timestamp,
                favourite,
            ]);
        }
        catch (e) {
            console.error("DATABASE QUERY ERROR: ", e);
            res.sendStatus(401);
        }
        // Successful
        res.status(200).send(url);
    }
    else {
        res.sendStatus(401);
    }
});
// Delete a photo from the db and S3
exports.deletePhoto = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sub } = req.body.payload;
    const path = req.headers["photo_path"];
    if (typeof path === "string") {
        // First remove photo from S3, then remove table row
        const successful = yield storage_1.deletePhotoFromS3(path);
        if (successful) {
            try {
                yield connection.query("DELETE FROM photos WHERE path = $1 AND user_id = $2", [path, sub]);
                res.sendStatus(200);
            }
            catch (e) {
                console.error("ERROR DELETING PHOTO FROM DATABASE: ", e);
                res.sendStatus(401);
            }
        }
        else {
            res.sendStatus(401);
        }
    }
});
// Edit an existing user photo
exports.editPhoto = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { path, photo_name, price, comments, favourite, payload } = req.body;
    try {
        yield connection.query("UPDATE photos SET photo_name = $1, price = $2, comments = $3, \
      favourite = $4 WHERE path = $5 AND user_id = $6", [photo_name, price, comments, favourite, path, payload.sub]);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("ERROR EDITING PHOTO IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
exports.updateFavourite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { path, favourite, payload } = req.body;
    try {
        yield connection.query("UPDATE photos SET favourite = $1 WHERE path = $2 AND user_id = $3", [favourite, path, payload.sub]);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("ERROR CHANGING PHOTO IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
