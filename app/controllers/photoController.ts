
/*
 * Here we define the logic for our user controller
 */

import connection = require('../config/dbConnection');
import aws = require('../config/aws');

let S3_BUCKET: string | undefined = process.env.S3_BUCKET_NAME;

const s3 = new aws.S3(); // service object

import dotenv from "dotenv";
import { GetObjectRequest, PutObjectRequest } from 'aws-sdk/clients/s3';
dotenv.config();

async function uploadImageToS3(path: string, imageData: any): Promise<boolean> {
    if (typeof S3_BUCKET === "string") {
        let uploadParams: PutObjectRequest = { // config
            Bucket: S3_BUCKET,
            Key: path,
            Body: imageData
        };

        try {
            await s3.upload(uploadParams).promise(); // upload image
            return true;
        } catch (e) {
            console.log("Error uploading the image", e);
        }
    }
    return false;
}

async function getPhotoDataFromS3(path: string): Promise<String | null> {
    if (typeof S3_BUCKET === "string") {
        try {
            const fetchParams: GetObjectRequest = {
                Bucket: S3_BUCKET,
                Key: path
            };

            const data = await s3.getObject(fetchParams).promise();
            if (typeof data.Body !== "undefined") { // Image data retrieved
                return data.Body.toString('binary');
            }
            return null;
        } catch (e) {
            console.log("Error retrieving file", e);
        }
    }
    return null; // error
}

async function deletePhotoFromS3(path: string): Promise<boolean> {
    if (typeof S3_BUCKET === "string") {
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
    }
    return false;
}

// Get a list of all user photos, sorted by restaurant
export async function retrievePhotos(id: number): Promise<any[] | null> {
    const photoQuery = "SELECT r.id restaurant_id, r.name restaurant_name, r.rating restaurant_rating, r.lat restaurant_lat, \
        r.lng restaurant_lng, p.path, p.photo_name, p.price, p.comments, p.time_taken FROM restaurants r INNER JOIN \
        photos p ON r.id = p.restaurant_id WHERE p.user_id = $1 ORDER BY r.name";

    try {
        const result = await connection.query(photoQuery, [id]);
        const rows: any[] = result.rows;

        for (let photo of rows) {
            photo.data = await getPhotoDataFromS3(photo.path); // photo data
        }
        return rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

// Sort photos by restaurant 
export async function retrieveFoodprint(id: number): Promise<any[] | null> {
    const restaurantQuery = "SELECT id restaurant_id, name restaurant_name, rating restaurant_rating, \
        lat restaurant_lat, lng restaurant_lng FROM restaurants r WHERE id IN ( \
        SELECT DISTINCT restaurant_id FROM photos WHERE user_id = $1 \
        ) ORDER BY r.name";

    const photoQuery = "SELECT path, photo_name, price, comments, time_taken FROM photos WHERE restaurant_id = $1 AND user_id = $2";

    try {
        const restaurants: any[] = (await connection.query(restaurantQuery, [id])).rows;
        for (let r of restaurants) {
            let photos: any[] = (await connection.query(photoQuery, [r.restaurant_id, id])).rows;
            for (let p of photos) {
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

export async function savePhoto(req: any, res: any): Promise<void> {

    const user_id: number = req.body.userId;
    const { path, data, details, location } = req.body.image;

    // Store image data in S3 Bucket
    const uploaded: boolean = await uploadImageToS3(path, data);
    if (uploaded) {
        try {
            // 1. Check if restaurant exists in restaurant table, if not then insert
            const saved_restaurants: any[] = (await connection.query("SELECT name FROM restaurants WHERE id = $1", [location.id])).rows;

            if (saved_restaurants.length == 0) {
                await connection.query("INSERT INTO restaurants (id, name, rating, lat, lng) \
                    VALUES ($1, $2, $3, $4, $5)", [location.id, location.name, location.rating, location.lat,
                location.lng]);
            }

            // 2. Store image details in pgsql table
            await connection.query("INSERT INTO photos (path, user_id, photo_name, price, comments, restaurant_id, time_taken) \
                VALUES ($1, $2, $3, $4, $5, $6, $7)", [path, user_id, details.name, details.price, details.comments,
                location.id, details.timestamp]);

        } catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
        // Successful
        res.sendStatus(200);
    }
    else {
        res.status(401).send("Error uploading image to S3");
    }
};

// Delete a photo from the db and S3 
export async function deletePhoto(req: any, res: any): Promise<void> {

    const path: string = req.headers['photo_path'];

    // First remove photo from S3, then remove table row
    const successful: boolean = await deletePhotoFromS3(path);
    if (successful) {
        try {
            await connection.query("DELETE FROM photos WHERE path = $1", [path]);
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

export async function editPhoto(req: any, res: any): Promise<void> {
    const { path, photo_name, price, comments } = req.body;
    try {
        await connection.query("UPDATE photos SET photo_name = $1, price = $2, comments = $3 WHERE path = $4",
            [photo_name, price, comments, path]);
        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.sendStatus(401);
    }
};