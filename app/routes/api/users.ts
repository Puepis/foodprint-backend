
/*
 * This module defines the endpoints for users
 */

import express from 'express';
const router = express.Router();
import controller = require('../../controllers/userController');

router.post('/register', controller.registerUser);
router.post('/login', controller.loginUser);
router.get('/foodprint', controller.verifyToken, controller.getFoodprint);
router.post('/avatar');
router.post('/change/password');
router.post('change/username');
router.delete('/delete');

module.exports = router;
