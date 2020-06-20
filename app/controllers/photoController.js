
/*
 * Here we define the logic for our user controller
 */

const connection = require('../config/dbConnection');
const aws = require('../config/aws');
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const s3 = new aws.S3(); // service object

// Async/await
const util = require('util');
const query = util.promisify(connection.query).bind(connection);

require('dotenv').config();

async function uploadImageToS3(path, imageData) {
    const uploadParams = { // config
        Bucket: S3_BUCKET,
        Key: path,
        Body: imageData 
    };

    try {
        const data = await s3.upload(uploadParams).promise(); // upload image
        return true; 
    } catch (e) {
        console.log("Error uploading the image", e);
    }
    return false;
}

async function getPhotoDataFromS3(path) {
    try {
        const fetchParams = {
            Bucket: S3_BUCKET,
            Key: path
        };

        const data = await s3.getObject(fetchParams).promise();
        return data.Body.toString('binary');
    } catch (e) {
        console.log("Error retrieving file", e);
    }
    return null; // an error occurred
}

async function deletePhotoFromS3(path) {
    try {
        const params = {
            Bucket: S3_BUCKET,
            Key: path
        }
        await s3.deleteObject(params).promise();
        return true;
    } catch (e) {
        console.log("Error deleting file", e);
    }
    return false;
}

// Get a list of all user photos, sorted by restaurant
exports.retrievePhotos = async (id) => {
    const photoQuery = "SELECT r.id restaurant_id, r.name restaurant_name, r.rating restaurant_rating, r.lat restaurant_lat, \
        r.lng restaurant_lng, p.path, p.photo_name, p.price, p.caption, p.time_taken FROM restaurants r \
        INNER JOIN photos p ON r.id = p.restaurant_id WHERE p.user_id = $1 ORDER BY r.name";

    try {
        var rows = (await query(photoQuery, [id])).rows;
        for (photo of rows) {
            photo.data = await getPhotoDataFromS3(photo.path); // photo data
        }
        return rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

exports.retrieveFoodprint2 = async (id) => {
    const photos = await this.retrievePhotos(id);
    var result = [];
    if (photos != null) {
        var prevResId = "";
        var prevRestaurant;
        for (p of photos) {
            var newPhoto = {
                data: p.data,
                path: p.path,
                photo_name: p.photo_name,
                price: p.price,
                caption: p.caption,
                restaurant_id: p.restaurant_id,
                time_taken: p.time_taken
            }

            if (p.restaurant_id.localeCompare(prevResId) == 0) { // same restaurant
                prevRestaurant.photos.push(newPhoto);
            }
            else { // different restaurant
                prevResId = p.restaurant_id;
                if (prevRestaurant != null) {
                    result.push(prevRestaurant);
                }
                prevRestaurant = { // set to current restaurant
                    restaurant_id: p.restaurant_id,
                    restaurant_name: p.restaurant_name,
                    restaurant_rating: p.restaurant_rating,
                    restaurant_lat: p.restaurant_lat,
                    restaurant_lng: p.restaurant_lng,
                    photos: [newPhoto]
                }
            }
        }
        if (prevRestaurant != null) {
            result.push(prevRestaurant);
        }
    }
    return result;
};

// Sort photos by restaurant 
exports.retrieveFoodprint = async (id) => {
    const restaurantQuery = "SELECT id restaurant_id, name restaurant_name, rating restaurant_rating, \
        lat restaurant_lat, lng restaurant_lng FROM restaurants r WHERE id IN ( \
        SELECT DISTINCT restaurant_id FROM photos WHERE user_id = $1 \
        ) ORDER BY r.name";
    
    const photoQuery = "SELECT * FROM photos WHERE restaurant_id = $1 AND user_id = $2";

    try {
        var restaurants = (await query(restaurantQuery, [id])).rows;
        for (r of restaurants) {
            var photos = (await query(photoQuery, [r.restaurant_id, id])).rows;
            for (p of photos) {
                p.data = await getPhotoDataFromS3(p.path);
            }
            r.photos = photos;
        }
        return restaurants;
    } catch (e) {
        console.log(e);
        return null;
    }
}

exports.savePhoto = async (req, res) => {

    const user_id = req.body.userId;
    const {path, data, details, location} = req.body.image;

    // Store image data in S3 Bucket
    const uploaded = await uploadImageToS3(path, data);
    if (uploaded) {
         try {
            // 1. Check if restaurant exists in restaurant table, if not then insert
            const saved_restaurant = await query("SELECT name FROM restaurants WHERE id = $1", [location.id]);
        
            if (saved_restaurant.rows.length == 0) { 
                await query ("INSERT INTO restaurants (id, name, rating, lat, lng) \
                    VALUES ($1, $2, $3, $4, $5)", [location.id, location.name, location.rating, location.lat, location.lng]);
            }

            // 2. Store image details in pgsql table
            await query ("INSERT INTO photos (path, user_id, photo_name, price, caption, restaurant_id, time_taken) \
                VALUES ($1, $2, $3, $4, $5, $6, $7)", [path, user_id, details.name, details.price, details.caption, 
                location.id, details.timestamp]);

        } catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
        // Successful
        res.status(200).send("Successfully saved");
    }
    else {
        res.status(401).send("Error uploading image to S3");
    }
};

// Delete a photo from the db and S3 
exports.deletePhoto = async (req, res) => {
    const path = req.headers['photo_path'];
    
    // First remove photo from S3, then remove table row
    var successful = await deletePhotoFromS3(path);
    if (successful) {
        try {
            await query("DELETE FROM photos WHERE path = $1", [path]);
            res.sendStatus(200);
        } catch (e) {
            console.log(e);
            res.sendStatus(401);
        }
    }
    else {
        res.sendStatus(401);
    }
};

exports.editPhoto = async (req, res) => {
    const {path, photo_name, price, caption} = req.body;
    try {
        await query("UPDATE photos SET photo_name = $1, price = $2, caption = $3 WHERE path = $4", 
            [photo_name, price, caption, path]);
        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.sendStatus(401);
    }
};