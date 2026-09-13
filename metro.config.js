// Metro must follow the `file:` symlink to ../macha-ts and treat it as source
// it is allowed to read. Without the extra watch root the bundler resolves
// @macha/core to a path outside the project and fails at import time.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, '..', 'macha-ts');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [coreRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(coreRoot, 'node_modules'),
];
// @macha/core ships ESM with `.js` extensions in its relative imports.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
