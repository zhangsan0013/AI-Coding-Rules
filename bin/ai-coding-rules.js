#!/usr/bin/env node

'use strict';

const { main } = require('../src/cli');

main(process.argv.slice(2)).catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
