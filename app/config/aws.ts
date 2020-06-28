

import aws = require('aws-sdk');
aws.config.update({ region: 'ca-central-1' });

export = aws;

