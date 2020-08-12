import connection = require("../config/dbConnection");
import { Request, Response } from "express";
import {
  uploadImageToS3,
  deletePhotoFromS3,
  parseImageData,
} from "../image_storage/storage";

// Organize all user photos based on restaurant
export const retrieveFoodprint = async (id: number): Promise<any[] | null> => {
  const restaurantQuery =
    "SELECT DISTINCT place_id FROM photos WHERE user_id = $1";

  const photoQuery =
    "SELECT path, url, photo_name, price, comments, time_taken, favourite FROM photos \
        WHERE place_id = $1 AND user_id = $2";

  try {
    const restaurants = (await connection.query(restaurantQuery, [id])).rows;
    return await Promise.all(
      restaurants.map(async (restaurant) => {
        const photos = (
          await connection.query(photoQuery, [restaurant.place_id, id])
        ).rows;
        return { ...restaurant, photos: photos };
      })
    );
  } catch (e) {
    console.error("RETRIEVING FOODPRINT ERROR: ", e);
    return null;
  }
};

// Save photo on server
export const savePhoto = async (req: Request, res: Response): Promise<void> => {
  const { sub } = req.body.payload;
  const { path, favourite, details, place_id, data } = req.body.image;
  const imgData: Uint8Array = parseImageData(data);

  // Store image data in S3 Bucket
  const url: string | null = await uploadImageToS3(path, imgData);
  if (url) {
    try {
      await connection.query(
        "INSERT INTO photos (path, url, user_id, photo_name, price, comments, \
          place_id, time_taken, favourite) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [
          path,
          url,
          sub,
          details.name,
          details.price,
          details.comments,
          place_id,
          details.timestamp,
          favourite,
        ]
      );
    } catch (e) {
      console.error("DATABASE QUERY ERROR: ", e);
      res.sendStatus(401);
    }
    // Successful
    res.status(200).send(url);
  } else {
    res.sendStatus(401);
  }
};

// Delete a photo from the db and S3
export const deletePhoto = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { sub } = req.body.payload;
  const path: string | string[] | undefined = req.headers["photo_path"];

  if (typeof path === "string") {
    // First remove photo from S3, then remove table row
    const successful: boolean = await deletePhotoFromS3(path);
    if (successful) {
      try {
        await connection.query(
          "DELETE FROM photos WHERE path = $1 AND user_id = $2",
          [path, sub]
        );
        res.sendStatus(200);
      } catch (e) {
        console.error("ERROR DELETING PHOTO FROM DATABASE: ", e);
        res.sendStatus(401);
      }
    } else {
      res.sendStatus(401);
    }
  }
};

// Edit an existing user photo
export const editPhoto = async (req: Request, res: Response): Promise<void> => {
  const { path, photo_name, price, comments, favourite, payload } = req.body;
  try {
    await connection.query(
      "UPDATE photos SET photo_name = $1, price = $2, comments = $3, \
      favourite = $4 WHERE path = $5 AND user_id = $6",
      [photo_name, price, comments, favourite, path, payload.sub]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error("ERROR EDITING PHOTO IN DATABASE: ", e);
    res.sendStatus(401);
  }
};

export const updateFavourite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { path, favourite, payload } = req.body;
  try {
    await connection.query(
      "UPDATE photos SET favourite = $1 WHERE path = $2 AND user_id = $3",
      [favourite, path, payload.sub]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error("ERROR CHANGING PHOTO IN DATABASE: ", e);
    res.sendStatus(401);
  }
};
