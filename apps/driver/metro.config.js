const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
// Only the pure card module is shared; never bundle server code or root dependencies.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../../src/lib/card')];
module.exports = config;
