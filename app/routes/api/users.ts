
/*
 * This module defines the endpoints for users
 */

import express from 'express';
const router = express.Router();
import controller = require('../../controllers/userController');

router.post('/register', controller.registerUser);
router.post('/login', controller.loginUser);
router.get('/photos', controller.verifyToken, controller.getPhotos);
router.get('/foodprint', controller.verifyToken, controller.getFoodprint);

module.exports = router;
