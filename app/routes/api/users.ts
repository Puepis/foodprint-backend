
/*
 * This module defines the endpoints for modifying the user's account.
 */

import express from 'express';
const router = express.Router();
import controller = require('../../controllers/userController');

router.post('/register', controller.registerUser);
router.post('/login', controller.loginUser);
router.get('/foodprint', controller.verifyToken, controller.getFoodprint);
router.post('/avatar', controller.changeAvatar);
router.post('/change/password', controller.updatePassword);
router.post('/change/username', controller.updateUsername);
router.delete('/delete', controller.deleteUser);

module.exports = router;
