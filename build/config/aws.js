"use strict";
const aws = require("aws-sdk");
aws.config.update({ region: 'ca-central-1' });
module.exports = aws;
