
/*
 * Here we define the logic for our user controller
 */

import connection = require('../config/dbConnection');
import aws = require('../config/aws');

let S3_BUCKET: string | undefined = process.env.S3_BUCKET_NAME;

const s3 = new aws.S3(); // service object

import dotenv from "dotenv";
import { PutObjectRequest } from 'aws-sdk/clients/s3';
dotenv.config();

async function uploadImageToS3(path: string, imageData: Uint8Array): Promise<String | null> {
    console.log(imageData.length);
    if (typeof S3_BUCKET === "string") {
        let uploadParams: PutObjectRequest = { // config
            Bucket: S3_BUCKET,
            Key: "cat.txt",
            Body: imageData
        };

        try {
            const data = await s3.upload(uploadParams).promise(); // upload image
            console.log(data.Location);
            return data.Location;
        } catch (e) {
            console.log("Error uploading the image", e);
        }
    }
    return null;
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
        r.lng restaurant_lng, p.path, p.url, p.photo_name, p.price, p.comments, p.time_taken FROM restaurants r INNER JOIN \
        photos p ON r.id = p.restaurant_id WHERE p.user_id = $1 ORDER BY r.name";

    try {
        const result = await connection.query(photoQuery, [id]);
        const rows: any[] = result.rows;
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

    const photoQuery = "SELECT path, url, photo_name, price, comments, time_taken FROM photos \
        WHERE restaurant_id = $1 AND user_id = $2";

    try {
        const restaurants: any[] = (await connection.query(restaurantQuery, [id])).rows;
        for (let r of restaurants) {
            let photos: any[] = (await connection.query(photoQuery, [r.restaurant_id, id])).rows;
            r.photos = photos;
        }
        return restaurants;
    } catch (e) {
        console.log(e);
        return null;
    }
}

// Convert string to Uint8Array
function parseImageData(str: String): Uint8Array {
    const strBytes: Array<String> = str.substring(1, str.length).split(', '); 
    const numBytes: Array<number> = strBytes.map((value) => Number(value));
    return new Uint8Array(numBytes);
} 

export async function savePhoto(req: any, res: any): Promise<void> {

    
    const user_id: number = req.body.userId;
    const { path, details, location } = req.body.image;
    const data: Uint8Array = parseImageData(req.body.image.data);
    
    // Store image data in S3 Bucket
    const url: String | null = await uploadImageToS3(path, data);
    if (url != null) {

        try {
            // 1. Check if restaurant exists in restaurant table, if not then insert
            const saved_restaurants: any[] = (await connection.query("SELECT name FROM restaurants WHERE id = $1", [location.id])).rows;

            if (saved_restaurants.length == 0) {
                await connection.query("INSERT INTO restaurants (id, name, rating, lat, lng) \
                    VALUES ($1, $2, $3, $4, $5)", [location.id, location.name, location.rating, location.lat,
                location.lng]);
            }

            // 2. Store image details in pgsql table
            await connection.query("INSERT INTO photos (path, url, user_id, photo_name, price, comments, restaurant_id, time_taken) \
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [path, url, user_id, details.name, details.price, details.comments,
                location.id, details.timestamp]);

        } catch (e) {
            console.log(e);
            res.sendStatus(401);
        }
        // Successful
        res.status(200).send(url);
    }
    else {
        res.sendStatus(401);
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