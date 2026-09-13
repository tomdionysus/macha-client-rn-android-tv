import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic only. Anything importing `react-native` needs the Metro
    // resolver and belongs on a device, not here.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
