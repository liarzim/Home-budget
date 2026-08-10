import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.householdbudget.app',
  appName: 'Household Budget',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
