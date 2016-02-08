var Settings = require('settings');

var config = {
  common: {

  },
  development: {
    aws: {
      key: process.env.AWS_KEY,
      secret: process.env.AWS_SECRET,
      bucket: "mrr2.devtechlab.com",
      region: "us-east-1"
    }
  },
  devtechlab: {
    aws: {
      key: process.env.AWS_KEY,
      secret: process.env.AWS_SECRET,
      bucket: "mrr2.devtechlab.com",
      region: "us-east-1"
    }
  },
  devnet: {

  },
  aidnet: {
    
  }
};

var loadedConfig = new Settings(config);
module.exports = loadedConfig;