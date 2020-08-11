import aws = require("aws-sdk");
import {
  PutObjectRequest,
  ListObjectsV2Request,
  DeleteObjectsRequest,
  DeleteObjectRequest,
} from "aws-sdk/clients/s3";
import get from "lodash.get";

const S3_BUCKET: string = process.env.S3_BUCKET_NAME!;

aws.config.update({ region: "ca-central-1" });
const s3 = new aws.S3();

export const uploadImageToS3 = async (
  path: string,
  imageData: any
): Promise<string | null> => {
  if (typeof S3_BUCKET !== "string") return null;

  const uploadParams: PutObjectRequest = {
    // config
    Bucket: S3_BUCKET,
    Key: path,
    Body: Buffer.from(imageData),
    ContentType: "image/jpeg",
    ACL: "public-read",
  };

  try {
    return (await s3.upload(uploadParams).promise()).Location;
  } catch (e) {
    console.error("S3 UPLOAD ERROR: ", e);
    return null;
  }
};

// Delete a photo from the S3 bucket
export const deletePhotoFromS3 = async (path: string): Promise<boolean> => {
  if (typeof S3_BUCKET !== "string") return false;

  const deleteParams: DeleteObjectRequest = {
    Bucket: S3_BUCKET,
    Key: path,
  };
  try {
    await s3.deleteObject(deleteParams).promise();
    return true;
  } catch (e) {
    console.error("S3 DELETE OBJECT ERROR: ", e);
    return false;
  }
};

// Delete all photos in the given directory
export const emptyS3Directory = async (dir: string): Promise<void> => {
  const listParams: ListObjectsV2Request = {
    Bucket: S3_BUCKET,
    Prefix: dir,
  };

  // Get all objects from directory
  const listedObjects: any = await s3.listObjectsV2(listParams).promise();

  if (!get(listedObjects, "Contents.length", null)) return;

  let deleteObjects: any[] = [];
  const deleteParams: DeleteObjectsRequest = {
    Bucket: S3_BUCKET,
    Delete: { Objects: deleteObjects },
  };

  // Add all objects to the delete array
  listedObjects.Contents.forEach(({ Key }: any) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  // Delete objects
  await s3.deleteObjects(deleteParams).promise();

  // Continue deleting objects if there are more left
  if (listedObjects.IsTruncated) await emptyS3Directory(dir);
};

export const updateAvatarInS3 = async (
  id: any,
  avatar_data: any,
  file_name: any
): Promise<string | boolean> => {
  const avatar_dir: string = `${id}/avatar/`;
  const new_path: string = `${id}/avatar/${file_name}`;
  const data: Uint8Array = parseImageData(avatar_data);

  try {
    // Remove current avatar
    await emptyS3Directory(avatar_dir);

    // Upload new avatar
    const result: string | null = await uploadImageToS3(new_path, data);
    if (typeof result === "string") return result;
  } catch (e) {
    console.error("ERROR UPDATING AVATAR", e);
  }
  return false;
};

// Convert string to Uint8Array
export const parseImageData = (str: string) => {
  const strBytes: string[] = str.substring(1, str.length - 1).split(", ");
  const numBytes: number[] = strBytes.map((value) => Number(value));
  return new Uint8Array(numBytes);
};