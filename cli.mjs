#!/usr/bin/env node
import('./dist/cli.js').catch((err) => {
  console.error('cognitive-kit failed:', err.message);
  process.exit(1);
});
