
/*
 * This module defines the endpoints for modifying the user's photos.
 */

import express = require('express');
const router = express.Router();
import controller = require('../../controllers/photoController');

router.post('/', controller.savePhoto);
router.put('/', controller.editPhoto);
router.delete('/', controller.deletePhoto);
router.put('/favourite', controller.deletePhoto);

export = router;
