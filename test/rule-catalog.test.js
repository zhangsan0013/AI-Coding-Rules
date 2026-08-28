'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  loadRuleCatalog,
  resolveRuleModuleIds,
} = require('../src/rule-catalog');

const repositoryRoot = path.join(__dirname, '..');

function resolve(profile, signals, options = {}) {
  const catalog = loadRuleCatalog(repositoryRoot);
  return resolveRuleModuleIds(catalog, profile, signals, {
    ...options,
    repositoryRoot,
  });
}

test('catalog resolves the active bare-metal baseline in catalog order', () => {
  assert.deepEqual(resolve('bare-metal-c11', []), [
    'core.correctness',
    'core.change-policy',
    'c11.style',
    'c11.naming',
  ]);
});

test('catalog adds modules selected by signals', () => {
  assert.deepEqual(resolve('bare-metal-c11', ['public-interface', 'preprocessor']), [
    'core.correctness',
    'core.change-policy',
    'c11.style',
    'c11.naming',
    'c11.public-interface',
    'c11.preprocessor',
  ]);
});

test('catalog expands dependencies for an explicitly allowed draft profile', () => {
  assert.deepEqual(resolve('freertos-c11', ['freertos'], { allowDraft: true }), [
    'core.correctness',
    'core.change-policy',
    'c11.style',
    'c11.naming',
    'rtos.common',
    'rtos.freertos',
  ]);
});

test('catalog rejects draft profiles and modules without explicit opt-in', () => {
  assert.throws(
    () => resolve('freertos-c11', []),
    /Profile "freertos-c11" is draft.*--allow-draft/,
  );
  assert.throws(
    () => resolve('bare-metal-c11', ['freertos']),
    /Module "rtos.freertos" is draft.*--allow-draft/,
  );
});

test('catalog rejects unknown signals', () => {
  assert.throws(
    () => resolve('bare-metal-c11', ['not-a-signal']),
    /Unknown resolver signal "not-a-signal"/,
  );
});
