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
router.use(verifyToken);
router.post("/", savePhoto);
router.put("/", editPhoto);
router.delete("/", deletePhoto);
router.put("/favourite", updateFavourite);

export = router;
