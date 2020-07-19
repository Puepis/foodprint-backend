"use strict";
/*
 * This module defines the endpoints for users
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const controller = require("../../controllers/userController");
router.post('/register', controller.registerUser);
router.post('/login', controller.loginUser);
router.get('/photos', controller.verifyToken, controller.getPhotos);
router.get('/foodprint', controller.verifyToken, controller.getFoodprint);
module.exports = router;
