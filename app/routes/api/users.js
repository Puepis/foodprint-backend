
/*
 * This module defines the endpoints for users
 */

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/userController');

router.post('/register', controller.registerUser);
router.post('/login', controller.loginUser);
router.post('/logout', controller.logout);
router.get('/photos', controller.verifyToken, controller.getPhotos);
router.get('/foodprint', controller.verifyToken, controller.getFoodprint2);

module.exports = router;
