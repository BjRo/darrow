#!/usr/bin/env bash
set -eu

node --input-type=module <<'JS'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const path = 'src/price.js';
const original = readFileSync(path);
const name = '.price-arity-' + randomUUID() + '.js';
const backup = 'src/' + name;
const reference = JSON.stringify('./' + name);
writeFileSync(backup, original, { flag: 'wx' });
try {
  writeFileSync(path, [
    'export * from ' + reference + ';',
    'import { formatPrice as original } from ' + reference + ';',
    'let positionalCall = false;',
    'process.on("exit", () => { if (positionalCall) process.exitCode = 1; });',
    'export function formatPrice(...args) {',
    '  positionalCall ||= args.length !== 1;',
    '  return Reflect.apply(original, this, args);',
    '}',
  ].join('\n'));
  const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { formatPrice } from './src/price.js';
    import { cartTotal } from './src/cart.js';
    import { invoiceLine } from './src/invoice.js';
    assert.equal(formatPrice({ cents: 1234, currency: 'USD' }), '12.34 USD');
    assert.equal(cartTotal([{ cents: 100 }, { cents: 250 }]), '3.50 EUR');
    assert.equal(invoiceLine('Tea', 399, 'GBP'), 'Tea: 3.99 GBP');
  `], { stdio: 'inherit' });
  const tests = spawnSync('bash', ['test.sh'], { stdio: 'inherit' });
  if (probe.status !== 0 || tests.status !== 0) process.exitCode = 1;
} finally {
  writeFileSync(path, original);
  unlinkSync(backup);
}
JS
