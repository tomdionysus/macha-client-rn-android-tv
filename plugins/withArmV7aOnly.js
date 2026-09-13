const { withGradleProperties } = require('expo/config-plugins');

/**
 * Build 32-bit ARM only, because the target television has nothing else.
 *
 * The TCL 55B6B reports `ro.product.cpu.abilist = armeabi-v7a,armeabi`. There
 * is no arm64 on it, and no x86 anywhere near it, so the other three
 * architectures Expo emits by default are weight the APK carries to a set that
 * can never execute them: a universal build measured **93 MB against 29 MB**
 * pinned, over a link to the set that is not reliable at the best of times.
 *
 * **Why this is a plugin and not an edit.** `reactNativeArchitectures` lives in
 * `android/gradle.properties`, which `expo prebuild` generates and `.gitignore`
 * excludes — so pinning it by hand works until the next prebuild silently
 * restores all four. That is exactly what happened here: `COMPLETED.md` records
 * the pin as verified in the artifact on 2026-09-10, and the build on
 * 2026-09-12 produced a universal APK because `android/` had been regenerated
 * in between.
 *
 * It is the second setting this project has lost that way — `withAndroidTvOnly`
 * exists because the leanback flags went the same route. Anything that must
 * survive belongs in `app.json` and a plugin, never in the generated tree.
 */
const withArmV7aOnly = (config) =>
  withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const key = 'reactNativeArchitectures';
    const existing = properties.find((item) => item.type === 'property' && item.key === key);

    if (existing) {
      existing.value = 'armeabi-v7a';
      return config;
    }

    properties.push({
      type: 'comment',
      value: 'Pinned by plugins/withArmV7aOnly.js — the target TV is 32-bit ARM only.',
    });
    properties.push({ type: 'property', key, value: 'armeabi-v7a' });
    return config;
  });

module.exports = withArmV7aOnly;
