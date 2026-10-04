import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic only: anything importing `react-native` needs Metro and a device.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
