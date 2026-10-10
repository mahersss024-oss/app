import type { CapacitorConfig } from '@capacitor/cli';

const appUrl = process.env.SOUQ_HAMAD_APP_URL?.trim() || 'https://souqhamad.com';

const config: CapacitorConfig = {
  appId: 'com.souqhamad.app',
  appName: 'سوق حمد',
  webDir: 'www',
  bundledWebRuntime: false,
  appendUserAgent: ' SouqHamadCapacitor',
  server: {
    url: appUrl,
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    errorPath: 'offline.html',
    allowNavigation: ['souqhamad.com', 'www.souqhamad.com'],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 450,
      launchFadeOutDuration: 350,
      backgroundColor: '#08111d',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true,
    },
  },
};

export default config;
