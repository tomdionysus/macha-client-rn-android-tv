const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Declares a television-only app; config-tv alone leaves the APK installable
 * on a phone.
 *  - `leanback` required: excludes handsets.
 *  - `touchscreen` / `faketouch` not required: a set has neither, and requiring
 *    one stops it installing.
 *  - `LEANBACK_LAUNCHER`: asserted in case config-tv stops emitting it.
 *  - `stateAlwaysHidden`: keeps the IME down when the window regains focus on
 *    Settings; `adjustResize` is Expo's.
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
    if (launcher) {
      launcher.$['android:windowSoftInputMode'] = 'adjustResize|stateAlwaysHidden';
    }
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
