const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Make this an Android *television* app explicitly, not an app that happens to
 * run on one.
 *
 * `@react-native-tvos/config-tv` emits `android.software.leanback` with
 * `required="false"`, which is the permissive choice: it lets the same APK
 * install on a phone. This client is for the 10-foot UI only — D-pad focus, no
 * touch handling, no phone layouts — so the declaration is tightened to say so.
 *
 * What each line buys:
 *  - `leanback` required: the set is a hard requirement, so a phone is excluded
 *    rather than offered a UI with no way to move focus.
 *  - `touchscreen` / `faketouch` not required: a television has neither, and a
 *    required touchscreen is the single most common reason a TV refuses to
 *    install an Android app.
 *  - `LEANBACK_LAUNCHER`: emitted by config-tv already; asserted here so a
 *    change upstream cannot silently drop the app off the TV home screen.
 */
const withAndroidTvOnly = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    const features = manifest['uses-feature'];

    const setFeature = (name, required) => {
      const existing = features.find((feature) => feature.$?.['android:name'] === name);
      if (existing) {
        existing.$['android:required'] = String(required);
        return;
      }
      features.push({ $: { 'android:name': name, 'android:required': String(required) } });
    };

    setFeature('android.software.leanback', true);
    setFeature('android.hardware.touchscreen', false);
    setFeature('android.hardware.faketouch', false);

    const launcher = manifest.application?.[0]?.activity?.find(
      (activity) => activity.$?.['android:name'] === '.MainActivity',
    );
    const leanbackCategory = 'android.intent.category.LEANBACK_LAUNCHER';
    const mainFilter = launcher?.['intent-filter']?.find((filter) =>
      filter.action?.some((action) => action.$?.['android:name'] === 'android.intent.action.MAIN'),
    );
    if (mainFilter) {
      mainFilter.category = mainFilter.category ?? [];
      if (!mainFilter.category.some((c) => c.$?.['android:name'] === leanbackCategory)) {
        mainFilter.category.push({ $: { 'android:name': leanbackCategory } });
      }
    }

    return config;
  });

module.exports = withAndroidTvOnly;
