
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
        console.log("Upload success", data.Location);
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
    console.log("Getting photos");
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

// Sort photos by restaurant 
exports.getFoodprint = async (id) => {
    console.log("Getting foodprint");
    const restaurantQuery = "SELECT * FROM restaurants r WHERE id IN ( \
        SELECT DISTINCT restaurant_id FROM photos WHERE user_id = $1 \
        ) ORDER BY r.name";
    
    const photoQuery = "SELECT (path, photo_name, price, caption, time_taken) FROM \
        photos WHERE restaurant_id = $1 AND user_id = $2";

    try {
        var restaurants = (await query(restaurantQuery, [id])).rows;
        for (r of restaurants) {
            var photos = (await query(photoQuery, [r.id, id])).rows;
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

    console.log("Saving photo");
    const user_id = req.body.userId;
    const {path, data, details, location} = req.body.image;

    // Store image data in S3 Bucket
    const uploaded = await uploadImageToS3(path, data);
    console.log(uploaded);
    if (uploaded) {
         try {
            // 1. Check if restaurant exists in restaurant table, if not then insert
            const saved_restaurant = await query("SELECT name FROM restaurants WHERE id = $1", [location.id]);
        
            if (saved_restaurant.rows.length == 0) { 
                console.log("unique restaurant");
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

exports.photos = async (req, res) => {

    console.log("Retrieving photos");
    const id = req.body.id;

    try {
        // Get list of photos
        var rows = (await query("SELECT * FROM photos WHERE user_id = $1", [id])).rows;
        rows.forEach(async photo => {
            photo.data = getPhotoDataFromS3(photo.path); // photo data
            var restaurant = (await query("SELECT * FROM restaurants WHERE id = $1", [photo.restaurant_id])).rows[0];
            photo.restaurant_name = restaurant.name;
            photo.restaurant_rating = restaurant.rating;
            photo.restaurant_lat = restaurant.lat;
            photo.restaurant_lng = restaurant.lng;
        });
       
        res.status(200).json({photos: rows});
    } catch (e) {
        console.log(e);
        res.status(401).send(e);
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
};