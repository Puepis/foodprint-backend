"use strict";
/*
 * Logic for modifying and retrieving user photos.
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
exports.updateFavourite = exports.updateAvatarInS3 = exports.editPhoto = exports.deletePhoto = exports.savePhoto = exports.retrieveFoodprint = exports.emptyS3Directory = void 0;
const connection = require("../config/dbConnection");
const aws = require("aws-sdk");
const lodash_get_1 = __importDefault(require("lodash.get"));
const S3_BUCKET = process.env.S3_BUCKET_NAME;
aws.config.update({ region: 'ca-central-1' });
const s3 = new aws.S3();
const uploadImageToS3 = (path, imageData) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof S3_BUCKET !== "string")
        return null;
    const uploadParams = {
        Bucket: S3_BUCKET,
        Key: path,
        Body: Buffer.from(imageData),
        ContentType: "image/jpeg",
        ACL: 'public-read',
    };
    try {
        return (yield s3.upload(uploadParams).promise()).Location;
    }
    catch (e) {
        console.error("S3 UPLOAD ERROR: ", e);
        return null;
    }
});
// Delete a photo from the S3 bucket
const deletePhotoFromS3 = (path) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof S3_BUCKET !== "string")
        return false;
    const deleteParams = {
        Bucket: S3_BUCKET,
        Key: path
    };
    try {
        yield s3.deleteObject(deleteParams).promise();
        return true;
    }
    catch (e) {
        console.error("S3 DELETE OBJECT ERROR: ", e);
        return false;
    }
});
// Delete all photos in the given directory
exports.emptyS3Directory = (dir) => __awaiter(void 0, void 0, void 0, function* () {
    const listParams = {
        Bucket: S3_BUCKET,
        Prefix: dir
    };
    // Get all objects from directory 
    const listedObjects = yield s3.listObjectsV2(listParams).promise();
    if (!lodash_get_1.default(listedObjects, "Contents.length", null))
        return;
    let deleteObjects = [];
    const deleteParams = {
        Bucket: S3_BUCKET,
        Delete: { Objects: deleteObjects }
    };
    // Add all objects to the delete array
    listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });
    // Delete objects
    yield s3.deleteObjects(deleteParams).promise();
    // Continue deleting objects if there are more left
    if (listedObjects.IsTruncated)
        yield exports.emptyS3Directory(dir);
});
// Sort photos by restaurant 
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
// Convert string to Uint8Array
const parseImageData = (str) => {
    const strBytes = str.substring(1, str.length - 1).split(', ');
    const numBytes = strBytes.map((value) => Number(value));
    return new Uint8Array(numBytes);
};
// Responsible for saving the photo to db
exports.savePhoto = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user_id = req.body.userId;
    const { path, favourite, details, place_id } = req.body.image;
    const data = parseImageData(req.body.image.data);
    // Store image data in S3 Bucket
    const url = yield uploadImageToS3(path, data);
    if (url) {
        try {
            yield connection.query("INSERT INTO photos (path, url, user_id, photo_name, price, comments, place_id, time_taken, favourite) \
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [path, url, user_id, details.name, details.price, details.comments,
                place_id, details.timestamp, favourite]);
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
    const path = req.headers['photo_path'];
    if (typeof path === "string") {
        // First remove photo from S3, then remove table row
        const successful = yield deletePhotoFromS3(path);
        if (successful) {
            try {
                yield connection.query("DELETE FROM photos WHERE path = $1", [path]);
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
    const { path, photo_name, price, comments, favourite } = req.body;
    try {
        yield connection.query("UPDATE photos SET photo_name = $1, price = $2, comments = $3, favourite = $4 WHERE path = $5", [photo_name, price, comments, favourite, path]);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("ERROR EDITING PHOTO IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
/*
 * Updates the user's avatar in S3. Returns either the image url or false.
 */
exports.updateAvatarInS3 = (id, avatar_data, file_name) => __awaiter(void 0, void 0, void 0, function* () {
    const avatar_dir = `${id}/avatar/`;
    const new_path = `${id}/avatar/${file_name}`;
    const data = parseImageData(avatar_data);
    try {
        // Remove current avatar
        yield exports.emptyS3Directory(avatar_dir);
        // Upload new avatar
        const result = yield uploadImageToS3(new_path, data);
        if (typeof result === "string")
            return result;
    }
    catch (e) {
        console.error("ERROR UPDATING AVATAR", e);
    }
    return false;
});
exports.updateFavourite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { path, favourite } = req.body;
    try {
        yield connection.query("UPDATE photos SET favourite = $1 WHERE path = $2", [favourite, path]);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("ERROR CHANGING PHOTO IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
