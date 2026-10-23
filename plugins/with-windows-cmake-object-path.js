const { withGradleProperties } = require('expo/config-plugins');

/**
 * Expo SDK 58's root Gradle plugin applies this documented property to every
 * Android CMake module, including Worklets and Reanimated. Its default (1024)
 * assumes Windows long paths are enabled; 200 restores CMake's path hashing
 * before Ninja reaches MAX_PATH on development machines without that setting.
 *
 * Using Expo's input property avoids afterEvaluate/finalizeDsl ordering and
 * replaces the upstream 1024 at its source rather than appending another -D.
 * See expo-modules-autolinking/android/expo-gradle-plugin/README.md.
 */
module.exports = function withWindowsCmakeObjectPath(config) {
  if (process.platform !== 'win32') return config;

  return withGradleProperties(config, mod => {
    const key = 'expo.android.cmakeObjectPathMax';
    // Keep repeated prebuilds idempotent, including files with duplicate keys.
    mod.modResults = mod.modResults.filter(item => item.type !== 'property' || item.key !== key);
    mod.modResults.push({ type: 'property', key, value: '200' });
    return mod;
  });
};
