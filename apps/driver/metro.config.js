const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
// Only pure card/rank modules are imported; never bundle server code or root dependencies.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../../src/lib')];
module.exports = config;
