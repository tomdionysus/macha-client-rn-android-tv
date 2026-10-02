// No `watchFolders` or extra `nodeModulesPaths`: core resolves from
// `node_modules`, and a `watchFolders` entry pointing at a path that does not
// exist in a clone fails the bundler at startup.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Core ships ESM with `.js` extensions in its relative imports and reaches its
// entry points through an `exports` map. Metro resolves neither by default.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
