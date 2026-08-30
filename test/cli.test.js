'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { main, parseArgs } = require('../src/cli');

function makeProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-coding-rules-test-'));
}

test('context arguments parse stages, selectors, budget, and format', () => {
  const options = parseArgs([
    'context',
    '--stage', 'rules',
    '--budget', '6000',
    '--module', 'embedded.interrupts',
    '--rule', 'EMB-ISR-NOWAIT-001',
    '--format', 'json',
  ]);

  assert.equal(options.command, 'context');
  assert.equal(options.stage, 'rules');
  assert.equal(options.budgetTokens, 6000);
  assert.deepEqual(options.moduleIds, ['embedded.interrupts']);
  assert.deepEqual(options.ruleIds, ['EMB-ISR-NOWAIT-001']);
  assert.equal(options.format, 'json');
});

test('init creates rules, manifest, selected profile, and project files', async () => {
  const project = makeProject();

  await main(['init', '--project', project]);

  assert.ok(fs.existsSync(path.join(project, '.ai-rules', 'rules', 'INDEX.md')));
  assert.ok(fs.existsSync(path.join(project, '.ai-rules', '.install-manifest.json')));
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /AI-CODING-RULES:BEGIN/);
  assert.match(fs.readFileSync(path.join(project, 'PROJECT_RULES.md'), 'utf8'), /`rtos-c11`/);
});

test('installed instructions route through the catalog and precedence', async () => {
  const project = makeProject();

  await main(['init', '--project', project]);

  const agents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  assert.match(agents, /context --stage summary --budget 6000/);
  assert.match(agents, /--stage evidence/);
  assert.match(agents, /docs\/architecture\.md/);
  assert.match(agents, /state the uncertainty/);
  assert.match(agents, /Selected profile: `\.ai-rules\/profiles\/rtos-c11\.md`/);
});

test('init preserves existing project instructions and project rules', async () => {
  const project = makeProject();
  const agentsPath = path.join(project, 'AGENTS.md');
  const projectRulesPath = path.join(project, 'PROJECT_RULES.md');
  fs.writeFileSync(agentsPath, '# Existing instructions\n', 'utf8');
  fs.writeFileSync(projectRulesPath, '# Existing project rules\n', 'utf8');

  await main(['init', '--project', project]);

  const agents = fs.readFileSync(agentsPath, 'utf8');
  assert.match(agents, /# Existing instructions/);
  assert.match(agents, /AI-CODING-RULES:BEGIN/);
  assert.equal(fs.readFileSync(projectRulesPath, 'utf8'), '# Existing project rules\n');
});

test('update rejects modified managed files without force and succeeds with force', async () => {
  const project = makeProject();
  await main(['init', '--project', project]);
  const indexPath = path.join(project, '.ai-rules', 'rules', 'INDEX.md');
  fs.appendFileSync(indexPath, '\nlocal change\n', 'utf8');

  await assert.rejects(
    main(['update', '--project', project]),
    /modified locally/,
  );
  await main(['update', '--project', project, '--force']);
  assert.doesNotMatch(fs.readFileSync(indexPath, 'utf8'), /local change/);
});

test('dry-run does not write files', async () => {
  const project = makeProject();

  await main(['init', '--project', project, '--dry-run']);

  assert.equal(fs.existsSync(path.join(project, '.ai-rules')), false);
  assert.equal(fs.existsSync(path.join(project, 'AGENTS.md')), false);
});

test('provisional profiles install without an opt-in flag', async () => {
  const project = makeProject();

  await main(['init', '--project', project, '--profile', 'rtos-c11']);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(project, '.ai-rules', '.install-manifest.json'), 'utf8'),
  );
  assert.equal(manifest.profile, 'rtos-c11');
});

test('unknown profile statuses are rejected', async () => {
  const project = makeProject();

  await assert.rejects(
    main(['init', '--project', project, '--profile', 'not-a-profile']),
    /Unknown profile/,
  );
});

test('removed non-RTOS profiles are rejected', async () => {
  for (const profile of ['embedded-c11', 'bare-metal-c11']) {
    const project = makeProject();
    await assert.rejects(
      main(['init', '--project', project, '--profile', profile]),
      /Unknown profile/,
    );
  }
});

test('profile changes update the selected project profile during RTOS migration', async () => {
  const project = makeProject();

  await main(['init', '--project', project]);
  const manifestPath = path.join(project, '.ai-rules', '.install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.profile = 'bare-metal-c11';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const projectRulesPath = path.join(project, 'PROJECT_RULES.md');
  fs.writeFileSync(
    projectRulesPath,
    fs.readFileSync(projectRulesPath, 'utf8').replace('`rtos-c11`', '`bare-metal-c11`'),
    'utf8',
  );

  await main(['update', '--project', project, '--profile', 'rtos-c11']);

  assert.match(
    fs.readFileSync(path.join(project, 'PROJECT_RULES.md'), 'utf8'),
    /`rtos-c11`/,
  );
  assert.match(
    fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'),
    /Selected profile: `\.ai-rules\/profiles\/rtos-c11\.md`/,
  );
});
