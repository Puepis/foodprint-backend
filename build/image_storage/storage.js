"use strict";
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
exports.parseImageData = exports.updateAvatarInS3 = exports.emptyS3Directory = exports.deletePhotoFromS3 = exports.uploadImageToS3 = void 0;
const aws = require("aws-sdk");
const lodash_get_1 = __importDefault(require("lodash.get"));
const S3_BUCKET = process.env.S3_BUCKET_NAME;
aws.config.update({ region: "ca-central-1" });
const s3 = new aws.S3();
// Upload image file
exports.uploadImageToS3 = (path, imageData) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof S3_BUCKET !== "string")
        return null;
    const uploadParams = {
        Bucket: S3_BUCKET,
        Key: path,
        Body: Buffer.from(imageData),
        ContentType: "image/jpeg",
        ACL: "public-read",
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
exports.deletePhotoFromS3 = (path) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof S3_BUCKET !== "string")
        return false;
    const deleteParams = {
        Bucket: S3_BUCKET,
        Key: path,
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
        Prefix: dir,
    };
    // Get all objects from directory
    const listedObjects = yield s3.listObjectsV2(listParams).promise();
    if (!lodash_get_1.default(listedObjects, "Contents.length", null))
        return;
    let deleteObjects = [];
    const deleteParams = {
        Bucket: S3_BUCKET,
        Delete: { Objects: deleteObjects },
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
// Update the user's avatar
exports.updateAvatarInS3 = (id, avatar_data, file_name) => __awaiter(void 0, void 0, void 0, function* () {
    const avatar_dir = `${id}/avatar/`;
    const new_path = `${id}/avatar/${file_name}`;
    const data = exports.parseImageData(avatar_data);
    try {
        // Remove current avatar
        yield exports.emptyS3Directory(avatar_dir);
        // Upload new avatar
        const result = yield exports.uploadImageToS3(new_path, data);
        if (typeof result === "string")
            return result;
    }
    catch (e) {
        console.error("ERROR UPDATING AVATAR", e);
    }
    return false;
});
// Convert string to Uint8Array
exports.parseImageData = (str) => {
    const strBytes = str.substring(1, str.length - 1).split(", ");
    const numBytes = strBytes.map((value) => Number(value));
    return new Uint8Array(numBytes);
};
