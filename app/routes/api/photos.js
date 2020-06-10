
/*
 * This module defines the endpoints for users
 */

const express = require('express');
const router = express.Router();
const controller = require('../../controllers/photoController');

router.post('/save', controller.savePhoto);
router.post('/get-photos', controller.retrievePhotos);
//router.post('/delete', controller.deletePhoto);
//router.get('/edit', controller.editPhoto);

module.exports = router;
