// `@machafoundation/core` installs from the registry into `node_modules`, so
// Metro needs no watch root outside the project and no second
// `nodeModulesPaths` entry. Both were here to follow the `file:` link to a
// sibling `../macha-ts` checkout; a clone that resolves core from the registry
// has no such directory, and a `watchFolders` entry pointing at a path that
// does not exist fails the bundler at startup rather than at import time.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Core ships ESM with `.js` extensions in its relative imports and reaches its
// entry points through an `exports` map. Metro resolves neither by default.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
