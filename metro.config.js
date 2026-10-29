// Sentry's wrapper around expo/metro-config — same config, plus source map upload.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

// Several packages under @trigger.dev/react-hooks (nanoid, jose) have no `react-native`
// key in their exports map, so Metro falls through to `default` — the Node build that
// imports `crypto`/`node:buffer`. Let native match `browser` too, the same fallback
// resolverMainFields already uses for legacy packages.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  ios: ['react-native', 'browser'],
  android: ['react-native', 'browser'],
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') return context.resolveRequest(context, moduleName, platform);

  // @s2-dev/streamstore's HTTP/2 transport holds a raw `import("node:http2")` that Hermes
  // cannot parse. Its factory only loads it when supportsHttp2() is true, so native always
  // takes the fetch transport — drop the module.
  if (moduleName.includes('transport/s2s')) return { type: 'empty' };

  // The exception to the rule above: @bugsnag/cuid keys its React Native build as
  // `default`, so the `browser` condition would win and read `navigator.userAgent.length`.
  if (moduleName === '#fingerprint' && context.originModulePath.includes('cuid')) {
    return context.resolveRequest(
      { ...context, unstable_conditionsByPlatform: {} },
      moduleName,
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
