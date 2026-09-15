#!/usr/bin/env node
'use strict';

const fs = require('fs');
const terser = require('terser');

async function main() {
  const source = fs.readFileSync(0, 'utf8');
  const result = await terser.minify(source, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) throw new Error('Terser produced no JavaScript output');
  process.stdout.write(result.code);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
