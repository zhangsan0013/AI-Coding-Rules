'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { loadRuleCatalog } = require('../src/rule-catalog');
const {
  buildRuleContext,
  estimateTokens,
} = require('../src/rule-context');

const repositoryRoot = path.join(__dirname, '..');
const catalog = loadRuleCatalog(repositoryRoot);

function context(signals, options = {}) {
  return buildRuleContext(catalog, 'rtos-c11', signals, {
    repositoryRoot,
    ...options,
  });
}

test('summary stays bounded and contains navigation metadata only', () => {
  const result = context([
    'c-source',
    'c-header',
    'public-interface',
    'preprocessor',
    'arithmetic',
    'memory',
    'mmio',
    'interrupt',
    'concurrency',
    'timeout',
    'dma',
    'representation',
    'startup',
    'rtos',
    'rtos-freertos',
    'rtos-rt-thread',
    'rtos-threadx',
    'architecture-arm',
    'architecture-riscv',
    'toolchain-gcc',
  ]);

  assert.equal(result.stage, 'summary');
  assert.ok(result.estimatedTokens <= 6000);
  assert.match(result.text, /embedded\.interrupts/);
  assert.match(result.text, /EMB-ISR-NOWAIT-001 \[MUST\]/);
  assert.doesNotMatch(result.text, /```/);
  assert.doesNotMatch(result.text, /Verification \(/);
  assert.deepEqual(result.selectedRules, []);
});

test('rules stage returns one selected rule without evidence', () => {
  const result = context(['interrupt'], {
    stage: 'rules',
    ruleIds: ['EMB-ISR-NOWAIT-001'],
  });

  assert.equal(result.selectedRules.length, 1);
  assert.equal(result.selectedRules[0].moduleId, 'embedded.interrupts');
  assert.match(result.text, /Every operation reachable from an interrupt handler MUST return/);
  assert.match(result.text, /- Rationale:/);
  assert.doesNotMatch(result.text, /Verification \(/);
  assert.doesNotMatch(result.text, /```/);
});

test('evidence stage adds verification and examples only for the selected rule', () => {
  const result = context(['interrupt'], {
    stage: 'evidence',
    ruleIds: ['EMB-ISR-NOWAIT-001'],
  });

  assert.match(result.text, /Verification \(agent\):/);
  assert.match(result.text, /^Correct:$/m);
  assert.match(result.text, /```c/);
});

test('rules stage refuses an unbounded full-module read', () => {
  assert.throws(
    () => context([], { stage: 'rules' }),
    (error) => error.code === 'CONTEXT_BUDGET_EXCEEDED'
      && /no rules were silently omitted/.test(error.message),
  );
});

test('context selectors must belong to the resolved set', () => {
  assert.throws(
    () => context([], { stage: 'rules', moduleIds: ['embedded.interrupts'] }),
    /not selected by the profile and signals/,
  );
  assert.throws(
    () => context(['interrupt'], { stage: 'rules', ruleIds: ['NOT-A-RULE-001'] }),
    /is not selected by the profile, signals, or module filters/,
  );
});

test('token estimates are deterministic UTF-8 byte estimates', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens(''), 0);
});

test('context budget has a conservative hard maximum', () => {
  assert.throws(
    () => context([], { budgetTokens: 8001 }),
    /no greater than 8000/,
  );
});
