

/*
 * This module defines the endpoints for restaurants
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.send('Base Endpoint'));

module.exports = router;
