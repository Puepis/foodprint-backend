
/*
 * This module defines the endpoints for users
 */

import express = require('express');
const router = express.Router();
import controller = require('../../controllers/photoController');

router.post('/', controller.savePhoto);
router.put('/', controller.editPhoto);
router.delete('/', controller.deletePhoto);

export = router;
