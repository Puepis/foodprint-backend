import express = require("express");
import {
  savePhoto,
  editPhoto,
  deletePhoto,
  updateFavourite,
} from "../controllers/photoController";
import { verifyToken } from "../auth/auth";
const router = express.Router();

// Authorized user photo endpoints
router.post("/", verifyToken, savePhoto);
router.put("/", verifyToken, editPhoto);
router.delete("/", verifyToken, deletePhoto);
router.put("/favourite", verifyToken, updateFavourite);

export = router;
