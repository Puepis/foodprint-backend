
/*
 * This module defines the endpoints for users
 */

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/photoController');

router.post('/', controller.savePhoto);
router.delete('/', controller.deletePhoto);
router.post('/get-photos', controller.photos);
//router.get('/edit', controller.editPhoto);

module.exports = router;
