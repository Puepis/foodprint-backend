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
exports.updateAvatarInS3 = exports.editPhoto = exports.deletePhoto = exports.savePhoto = exports.retrieveFoodprint = exports.emptyS3Directory = void 0;
const connection = require("../config/dbConnection");
const aws = require("../config/aws");
const lodash_get_1 = __importDefault(require("lodash.get"));
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const s3 = new aws.S3(); // service object
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
const deletePhotoFromS3 = (path) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof S3_BUCKET !== "string")
        return false;
    const params = {
        Bucket: S3_BUCKET,
        Key: path
    };
    try {
        yield s3.deleteObject(params).promise();
        return true;
    }
    catch (e) {
        console.error("S3 DELETE OBJECT ERROR: ", e);
        return false;
    }
});
function emptyS3Directory(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof S3_BUCKET === "string") {
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
                yield emptyS3Directory(dir);
        }
    });
}
exports.emptyS3Directory = emptyS3Directory;
;
// Sort photos by restaurant 
function retrieveFoodprint(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const restaurantQuery = "SELECT id restaurant_id, name restaurant_name, rating restaurant_rating, \
        lat restaurant_lat, lng restaurant_lng FROM restaurants r WHERE id IN ( \
        SELECT DISTINCT restaurant_id FROM photos WHERE user_id = $1 \
        ) ORDER BY r.name";
        const photoQuery = "SELECT path, url, photo_name, price, comments, time_taken, favourite FROM photos \
        WHERE restaurant_id = $1 AND user_id = $2";
        const typesQuery = "SELECT type FROM restaurant_types WHERE restaurant_id = $1";
        try {
            const restaurants = (yield connection.query(restaurantQuery, [id])).rows;
            return yield Promise.all(restaurants.map((restaurant) => __awaiter(this, void 0, void 0, function* () {
                const photos = (yield connection.query(photoQuery, [restaurant.restaurant_id, id])).rows;
                const types = (yield connection.query(typesQuery, [restaurant.restaurant_id])).rows;
                return Object.assign(Object.assign({}, restaurant), { photos: photos, restaurant_types: types });
            })));
        }
        catch (e) {
            console.error("RETRIEVING FOODPRINT ERROR: ", e);
            return null;
        }
    });
}
exports.retrieveFoodprint = retrieveFoodprint;
// Convert string to Uint8Array
const parseImageData = (str) => {
    const strBytes = str.substring(1, str.length - 1).split(', ');
    const numBytes = strBytes.map((value) => Number(value));
    return new Uint8Array(numBytes);
};
/// Responsible for saving the photo to db
function savePhoto(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user_id = req.body.userId;
        const { path, favourite, details, location } = req.body.image;
        const data = parseImageData(req.body.image.data);
        // Store image data in S3 Bucket
        const url = yield uploadImageToS3(path, data);
        if (url) {
            try {
                // 1. Check if restaurant exists in restaurant table, if not then insert
                const saved_restaurants = (yield connection.query("SELECT name FROM restaurants WHERE id = $1", [location.id])).rows;
                if (saved_restaurants.length == 0) {
                    yield connection.query("INSERT INTO restaurants (id, name, rating, lat, lng) \
                    VALUES ($1, $2, $3, $4, $5)", [location.id, location.name, location.rating, location.lat,
                        location.lng]);
                    const types = location.types;
                    yield Promise.all(types.map((type) => __awaiter(this, void 0, void 0, function* () {
                        yield connection.query("INSERT INTO restaurant_types (restaurant_id, type) \
                    VALUES ($1, $2)", [location.id, type]);
                    })));
                }
                // 2. Store image details in pgsql table
                yield connection.query("INSERT INTO photos (path, url, user_id, photo_name, price, comments, restaurant_id, time_taken, favourite) \
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [path, url, user_id, details.name, details.price, details.comments,
                    location.id, details.timestamp, favourite]);
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
                console.error("ERROR DELETING PHOTO FROM DATABASE: ", e);
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
}
exports.editPhoto = editPhoto;
;
/*
 * Updates the user's avatar in S3. Returns either the image url or false.
 */
function updateAvatarInS3(id, avatar_data, file_name) {
    return __awaiter(this, void 0, void 0, function* () {
        const avatar_dir = id + "/avatar/";
        const new_path = id + "/avatar/" + file_name;
        const data = parseImageData(avatar_data);
        try {
            // Remove current avatar
            yield emptyS3Directory(avatar_dir);
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
}
exports.updateAvatarInS3 = updateAvatarInS3;
