// No `watchFolders`: a path missing from a clone fails the bundler at startup.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Core ships ESM behind an `exports` map, which Metro does not resolve by default.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
