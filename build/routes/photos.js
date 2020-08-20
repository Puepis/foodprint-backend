"use strict";
const express = require("express");
const photoController_1 = require("../controllers/photoController");
const auth_1 = require("../auth/auth");
const router = express.Router();
// Authorized user photo endpoints
router.use(auth_1.verifyToken);
router.post("/", photoController_1.savePhoto);
router.put("/", photoController_1.editPhoto);
router.delete("/", photoController_1.deletePhoto);
router.put("/favourite", photoController_1.updateFavourite);
module.exports = router;
