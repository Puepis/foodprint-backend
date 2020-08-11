"use strict";
const express = require("express");
const photoController_1 = require("../controllers/photoController");
const auth_1 = require("../auth/auth");
const router = express.Router();
// Authorized user photo endpoints
router.post("/", auth_1.verifyToken, photoController_1.savePhoto);
router.put("/", auth_1.verifyToken, photoController_1.editPhoto);
router.delete("/", auth_1.verifyToken, photoController_1.deletePhoto);
router.put("/favourite", auth_1.verifyToken, photoController_1.updateFavourite);
module.exports = router;
