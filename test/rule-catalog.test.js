'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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

test('catalog resolves the bare-metal baseline in catalog order', () => {
  assert.deepEqual(resolve('bare-metal-c11', []), [
    'core.correctness',
    'core.change-policy',
    'c11.style',
    'c11.naming',
    'embedded.memory',
    'embedded.register-access',
    'embedded.startup',
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
    'embedded.memory',
    'embedded.register-access',
    'embedded.startup',
  ]);
});

test('catalog expands the generic RTOS profile and vendor adapter dependency', () => {
  assert.deepEqual(resolve('rtos-c11', ['rtos-freertos']), [
    'core.correctness',
    'core.change-policy',
    'c11.style',
    'c11.naming',
    'embedded.memory',
    'rtos.common',
    'rtos.freertos',
  ]);
});

test('catalog composes runtime, architecture, and toolchain selectors independently', () => {
  assert.deepEqual(resolve('embedded-c11', [
    'rtos-rt-thread',
    'architecture-riscv',
    'toolchain-gcc',
  ]), [
    'core.correctness',
    'core.change-policy',
    'c11.style',
    'c11.naming',
    'embedded.memory',
    'architecture.riscv',
    'rtos.common',
    'rtos.rt-thread',
    'toolchains.gcc',
  ]);
});

test('provisional profiles and modules resolve without an opt-in flag', () => {
  const catalog = loadRuleCatalog(repositoryRoot);
  const provisional = catalog.modules.filter((module) => module.status === 'provisional');
  assert.ok(provisional.length > 0, 'expected the catalog to carry provisional modules');

  const resolved = resolve('rtos-c11', ['rtos-freertos', 'architecture-arm', 'interrupt', 'dma', 'mmio']);
  assert.ok(
    resolved.includes('embedded.interrupts') && resolved.includes('architecture.arm'),
    'provisional modules should load for a provisional profile without --allow-draft',
  );
});

// Only `draft` fails closed. Nothing in the shipped tree is draft any more, so the gate is
// exercised against a throwaway fixture: the catalog status and the file's own Status line
// are cross-checked, which rules out simply mutating the in-memory catalog.
function writeDraftFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-catalog-draft-'));
  fs.mkdirSync(path.join(root, 'rules', 'draft'), { recursive: true });
  fs.mkdirSync(path.join(root, 'profiles'), { recursive: true });

  const module = [
    '# Draft Module',
    '',
    'Status: draft',
    '',
    '### EMB-FIXTURE-RULE-001 [MUST]',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'rules', 'draft', 'fixture.md'), module);

  for (const [id, status] of [['ready', 'active'], ['unready', 'draft']]) {
    fs.writeFileSync(
      path.join(root, 'profiles', `${id}.md`),
      `# ${id}\n\nStatus: ${status}\n`,
    );
  }

  const catalog = {
    schemaVersion: 1,
    signals: ['fixture'],
    modules: [{
      id: 'draft.fixture',
      path: 'draft/fixture.md',
      status: 'draft',
      loadWhen: ['fixture'],
      dependsOn: [],
    }],
    profiles: [
      { id: 'ready', path: 'ready.md', status: 'active', inherits: [], baseline: [] },
      { id: 'unready', path: 'unready.md', status: 'draft', inherits: [], baseline: [] },
    ],
  };
  return { root, catalog };
}

test('catalog rejects draft profiles and modules without explicit opt-in', (t) => {
  const { root, catalog } = writeDraftFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => resolveRuleModuleIds(catalog, 'unready', [], { repositoryRoot: root }),
    /Profile "unready" is draft.*--allow-draft/,
  );
  assert.throws(
    () => resolveRuleModuleIds(catalog, 'ready', ['fixture'], { repositoryRoot: root }),
    /Module "draft.fixture" is draft.*--allow-draft/,
  );

  assert.deepEqual(
    resolveRuleModuleIds(catalog, 'ready', ['fixture'], { repositoryRoot: root, allowDraft: true }),
    ['draft.fixture'],
  );
});

test('catalog rejects unknown signals', () => {
  assert.throws(
    () => resolve('bare-metal-c11', ['not-a-signal']),
    /Unknown resolver signal "not-a-signal"/,
  );
});

test('every cataloged module is populated and unreviewed modules expose paired examples', () => {
  const catalog = loadRuleCatalog(repositoryRoot);
  const rulePattern = /^###\s+[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}\s+\[(?:MUST|SHOULD|MAY)\]\s*$/m;

  for (const module of catalog.modules) {
    const content = fs.readFileSync(path.join(repositoryRoot, 'rules', module.path), 'utf8');
    assert.match(content, rulePattern, `module ${module.id} should contain a normative rule`);
    assert.doesNotMatch(content, /No normative rules have been defined yet\./);
    if (module.status !== 'active') {
      assert.match(content, /^Correct:\s*$/m, `unreviewed module ${module.id} needs a compliant example`);
      assert.match(content, /^Incorrect:\s*$/m, `unreviewed module ${module.id} needs a violating example`);
    }
  }
});
