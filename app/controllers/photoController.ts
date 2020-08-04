
/*
 * Here we define the logic for our user controller
 */

import connection = require('../config/dbConnection');
import aws = require('../config/aws');
import get from "lodash.get";

const S3_BUCKET: string | undefined = process.env.S3_BUCKET_NAME;

const s3 = new aws.S3(); // service object

import dotenv from "dotenv";
import { PutObjectRequest } from 'aws-sdk/clients/s3';
dotenv.config();

const uploadImageToS3 = async (path: string, imageData: any): Promise<string | null> => {
    if (typeof S3_BUCKET !== "string") return null;

    const uploadParams: PutObjectRequest = { // config
        Bucket: S3_BUCKET,
        Key: path,
        Body: Buffer.from(imageData),
        ContentType: "image/jpeg",
        ACL: 'public-read',
    };

    try {
        return (await s3.upload(uploadParams).promise()).Location;
    }
    catch (e) {
        console.error("S3 UPLOAD ERROR: ", e);
        return null;
    }
}

// Delete a photo from the S3 bucket
const deletePhotoFromS3 = async (path: string): Promise<boolean> => {
    if (typeof S3_BUCKET !== "string") return false;

    const params = {
        Bucket: S3_BUCKET,
        Key: path
    }
    try {
        await s3.deleteObject(params).promise();
        return true;
    }
    catch (e) {
        console.error("S3 DELETE OBJECT ERROR: ", e);
        return false;
    }
}

// Delete all photos in the given directory
export async function emptyS3Directory(dir: string): Promise<void> {
    if (typeof S3_BUCKET === "string") {
        const listParams = {
            Bucket: S3_BUCKET,
            Prefix: dir
        };

        // Get all objects from directory 
        const listedObjects: any = await s3.listObjectsV2(listParams).promise();

        if (!get(listedObjects, "Contents.length", null)) return;

        let deleteObjects: any[] = [];
        const deleteParams = {
            Bucket: S3_BUCKET,
            Delete: { Objects: deleteObjects }
        };

        // Add all objects to the delete array
        listedObjects.Contents.forEach(({ Key }: any) => {
            deleteParams.Delete.Objects.push({ Key });
        });

        // Delete objects
        await s3.deleteObjects(deleteParams).promise();

        // Continue deleting objects if there are more left
        if (listedObjects.IsTruncated) await emptyS3Directory(dir);
    }
};

// Sort photos by restaurant 
export async function retrieveFoodprint(id: number): Promise<any[] | null> {
    const restaurantQuery = "SELECT DISTINCT place_id FROM photos WHERE user_id = $1";

    const photoQuery = "SELECT path, url, photo_name, price, comments, time_taken, favourite FROM photos \
        WHERE place_id = $1 AND user_id = $2";

    try {
        const restaurants = (await connection.query(restaurantQuery, [id])).rows;
        return await Promise.all(restaurants.map(async restaurant => {
            const photos = (await connection.query(photoQuery, [restaurant.restaurant_id, id])).rows;
            return { ...restaurant, photos: photos }
        }));
    } catch (e) {
        console.error("RETRIEVING FOODPRINT ERROR: ", e);
        return null;
    }
}

// Convert string to Uint8Array
const parseImageData = (str: string) => {
    const strBytes: string[] = str.substring(1, str.length - 1).split(', ');
    const numBytes: number[] = strBytes.map((value) => Number(value));
    return new Uint8Array(numBytes);
}

// Responsible for saving the photo to db
export async function savePhoto(req: any, res: any): Promise<void> {


    const user_id: number = req.body.userId;
    const { path, favourite, details, place_id } = req.body.image;
    const data: Uint8Array = parseImageData(req.body.image.data);

    // Store image data in S3 Bucket
    const url: string | null = await uploadImageToS3(path, data);
    if (url) {
        try {
            await connection.query("INSERT INTO photos (path, url, user_id, photo_name, price, comments, place_id, time_taken, favourite) \
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [path, url, user_id, details.name, details.price, details.comments,
                place_id, details.timestamp, favourite]);

        } catch (e) {
            console.error("DATABASE QUERY ERROR: ", e);
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
            console.error("ERROR DELETING PHOTO FROM DATABASE: ", e);
            res.sendStatus(401);
        }
    }
    else {
        res.sendStatus(401);
    }
};

// Edit an existing user photo
export async function editPhoto(req: any, res: any): Promise<void> {
    const { path, photo_name, price, comments, favourite } = req.body;
    try {
        await connection.query("UPDATE photos SET photo_name = $1, price = $2, comments = $3, favourite = $4 WHERE path = $5",
            [photo_name, price, comments, favourite, path]);
        res.sendStatus(200);
    } catch (e) {
        console.error("ERROR EDITING PHOTO IN DATABASE: ", e);
        res.sendStatus(401);
    }
};

/*
 * Updates the user's avatar in S3. Returns either the image url or false.
 */
export async function updateAvatarInS3(id: any, avatar_data: any, file_name: any): Promise<string | boolean> {

    const avatar_dir: string = id + "/avatar/";
    const new_path = id + "/avatar/" + file_name;
    const data: Uint8Array = parseImageData(avatar_data);

    try {
        // Remove current avatar
        await emptyS3Directory(avatar_dir);

        // Upload new avatar
        const result: string | null = await uploadImageToS3(new_path, data);
        if (typeof result === "string") return result;
    }
    catch (e) {
        console.error("ERROR UPDATING AVATAR", e);
    }
    return false;
}


