
/*
 * Here we define the logic for our user controller
 */

const connection = require('../config/dbConnection');
const aws = require('../config/aws');
const S3_BUCKET = process.env.S3_BUCKET
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
            Bucket = S3_BUCKET,
            Key: path
        };

        const data = await s3.getObject(fetchParams).promise();
        return data.Body.toString('binary');
    } catch (e) {
        console.log("Error retrieving file", e);
    }
    return null; // an error occurred
}

exports.savePhoto = async (req, res) => {

    const user_id = req.body.userId;
    const {path, data, details, location} = req.body.image;

    // Store image data in S3 Bucket
    const uploaded = await uploadImageToS3(path, data);
    if (uploaded) {
         try {
            // 1. Check if restaurant exists in restaurant table, if not then insert
            const saved_restaurant = await query("SELECT name FROM restaurants WHERE restaurant_id = $1", [location.id]);
        
            if (saved_restaurant.rows.length == 0) { 
                await query ("INSERT INTO restaurants (id, name, rating, lat, lng) \
                    VALUES ($1, $2, $3, $4, $5)", [location.id, location.name, location.rating, location.lat, location.lng]);
            }

            // 2. Store image details in pgsql table
            await query ("INSERT INTO photos (path, data, user_id, name, price, caption, restaurant_id, time_taken) \
                VALUES ($1, $2, $3, $4, $5, $6, $7", [path, user_id, details.name, details.price, details.caption, 
                location.id, details.timestamp]);

        } catch (e) {
            console.log(e);
            res.status(401).json(e);
        }
        // Successful
        res.status(200).send("Successfully saved");
    }
    else {
        res.status(401).send("Error uploading image to S3");
    }
};


exports.retrievePhotos = async (req, res) => {

    const id = req.body.id;

    try {
        // Get list of photos
        var rows = (await query("SELECT * FROM photos WHERE user_id = $1", [id])).rows;
        rows.forEach(photo => {
            photo.data = await getPhotoDataFromS3(photo.path); // photo data
            var restaurant = (await query("SELECT name, rating, lat, lng "))
        });
        
        res.status(200).json({photos: rows});
    } catch (e) {
        console.log(e);
        res.status(401).json(e);
    }
};


exports.deletePhoto = async (req, res) => {
};

exports.editPhoto = async (req, res) => {
};