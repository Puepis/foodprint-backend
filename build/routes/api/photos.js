"use strict";
/*
 * This module defines the endpoints for users
 */
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/photoController");
router.post('/', controller.savePhoto);
router.put('/', controller.editPhoto);
router.delete('/', controller.deletePhoto);
module.exports = router;
