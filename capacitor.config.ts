import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.viso.deck',
  appName: 'VISO Deck',
  webDir: 'dist',
  loggingBehavior: 'none',
  server: { androidScheme: 'https' },
  android: {
    allowMixedContent: process.env.VISO_ANDROID_LOCAL_TEST === '1',
    backgroundColor: '#0b0c10',
    webContentsDebuggingEnabled: process.env.VISO_ANDROID_LOCAL_TEST === '1',
  },
};

export default config;
