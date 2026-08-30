'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.join(__dirname, '..');
const ruleHeading = /^###\s+(?<id>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,})\s+\[(?<strength>MUST|SHOULD|MAY)\]\s*$/gm;
const requiredMetadata = [
  'Applies when:',
  'Rationale:',
  'Verification (agent):',
  'Verification (target):',
  'Exceptions:',
];
const placeholder = /^(?:tbd|todo|n\/?a|to be determined|review|confirm|verify|none)\.?$/i;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRules(content) {
  const headings = [...content.matchAll(ruleHeading)];
  return headings.map((heading, index) => {
    const start = heading.index;
    const nextRule = index + 1 < headings.length ? headings[index + 1].index : content.length;
    const afterHeading = content.slice(start + heading[0].length);
    const nextSectionOffset = afterHeading.search(/^##\s/m);
    const nextSection = nextSectionOffset < 0
      ? content.length
      : start + heading[0].length + nextSectionOffset;
    const end = Math.min(nextRule, nextSection);
    return {
      id: heading.groups.id,
      strength: heading.groups.strength,
      section: content.slice(start, end),
    };
  });
}

function parseLedgerStatus(ledger) {
  const start = ledger.indexOf('## Current rule status');
  assert.notEqual(start, -1, 'audit ledger is missing the current rule status section');
  const nextHeading = ledger.indexOf('\n## ', start + 1);
  const section = ledger.slice(start, nextHeading < 0 ? ledger.length : nextHeading);
  const rows = [...section.matchAll(
    /^\|\s+`([^`]+)`\s+\|\s+(contract-pass|needs-rewrite|demote|delete)\s+\|\s+(pending|complete)\s+\|\s+(pending|complete)\s+\|$/gm,
  )];
  assert.ok(rows.length > 0, 'audit ledger current rule status section has no rows');
  return rows.map((row) => ({
    id: row[1],
    contract: row[2],
    domain: row[3],
    target: row[4],
  }));
}

function validateRuleFile(filePath, content) {
  const rules = parseRules(content);
  assert.ok(rules.length > 0, `${filePath} should contain a normative rule`);

  for (const rule of rules) {
    for (const metadata of requiredMetadata) {
      assert.match(rule.section, new RegExp(`^[-*]\\s*${escapeRegExp(metadata)}`, 'm'),
        `${filePath}: ${rule.id} is missing ${metadata}`);
    }

    if (rule.strength === 'MUST') {
      assert.equal((rule.section.match(/^Correct:\s*$/gm) || []).length, 1,
        `${filePath}: ${rule.id} must have exactly one Correct example`);
      assert.equal((rule.section.match(/^Incorrect:\s*$/gm) || []).length, 1,
        `${filePath}: ${rule.id} must have exactly one Incorrect example`);
    }

    for (const field of ['Verification (agent):', 'Verification (target):']) {
      const match = rule.section.match(new RegExp(`^-\\s*${escapeRegExp(field)}\\s*(.*)$`, 'm'));
      assert.ok(match, `${filePath}: ${rule.id} is missing ${field}`);
      const value = match[1].trim();
      assert.notEqual(value, '', `${filePath}: ${rule.id} has empty ${field}`);
      assert.doesNotMatch(value, placeholder,
        `${filePath}: ${rule.id} has placeholder ${field}`);
      assert.match(value, /\bpass\b/i,
        `${filePath}: ${rule.id} has no pass criterion in ${field}`);
      assert.match(value, /\bartifact\b/i,
        `${filePath}: ${rule.id} has no artifact in ${field}`);
    }
  }

  return rules;
}

function ruleFiles() {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (entry.name.endsWith('.md') && !['README.md', 'INDEX.md'].includes(entry.name)) {
        files.push(filePath);
      }
    }
  }

  visit(path.join(repositoryRoot, 'rules'));
  return files;
}

test('every normative rule satisfies the actionability contract', () => {
  const rules = [];
  for (const filePath of ruleFiles()) {
    const content = fs.readFileSync(filePath, 'utf8');
    rules.push(...validateRuleFile(path.relative(repositoryRoot, filePath), content));
  }

  assert.equal(rules.length, 171);
  assert.equal(rules.filter((rule) => rule.strength === 'MUST').length, 163);
  assert.equal(rules.filter((rule) => rule.strength === 'SHOULD').length, 8);
  assert.equal(rules.filter((rule) => rule.strength === 'MAY').length, 0);
});

test('the audit ledger names only current rule IDs and has no unresolved rewrite', () => {
  const currentIds = new Set();
  for (const filePath of ruleFiles()) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rule of parseRules(content)) {
      currentIds.add(rule.id);
    }
  }

  const ledger = fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'rule-audit-ledger.md'),
    'utf8',
  );
  const statusRows = parseLedgerStatus(ledger);
  const statusIds = statusRows.map((row) => row.id);

  assert.equal(new Set(statusIds).size, statusIds.length,
    'audit ledger current rule status contains duplicate IDs');
  assert.deepEqual([...new Set(statusIds)].sort(), [...currentIds].sort(),
    'audit ledger current rule status must exactly cover the current rule IDs');
  assert.equal(statusRows.filter((row) => row.contract === 'contract-pass').length, 171);
  assert.equal(statusRows.filter((row) => row.contract === 'needs-rewrite').length, 0);
  assert.equal(statusRows.filter((row) => row.contract === 'demote').length, 0);
  assert.equal(statusRows.filter((row) => row.contract === 'delete').length, 0);
  assert.equal(statusRows.filter((row) => row.domain === 'pending').length, 171);
  assert.equal(statusRows.filter((row) => row.target === 'pending').length, 171);
});

test('the project-rules template exposes verification governance inputs', () => {
  const template = fs.readFileSync(
    path.join(repositoryRoot, 'templates', 'PROJECT_RULES.md'),
    'utf8',
  );

  for (const field of [
    'Risk tiers and definitions:',
    'Mandatory check sets by tier:',
    'Approval policy for omitted checks:',
    'Evidence register:',
    'Outstanding-check owner directory:',
    'Public API field parser:',
  ]) {
    assert.match(template, new RegExp(`^- ${escapeRegExp(field)}`, 'm'),
      `PROJECT_RULES.md template is missing ${field}`);
  }
});

test('rule validation stops at the next rule heading and rejects missing evidence', () => {
  const fixture = [
    '# Fixture',
    '',
    '### FIXTURE-FIRST-001 [MUST]',
    '',
    '- Applies when: the first fixture is changed.',
    '- Rationale: the first fixture has a contract.',
    '- Verification (agent): inspect the first fixture.',
    '- Verification (target): run the first fixture.',
    '- Exceptions: none.',
    '',
    'Correct:',
    '',
    '```text',
    'valid',
    '```',
    '',
    '### FIXTURE-SECOND-001 [SHOULD]',
    '',
    '- Applies when: the second fixture is changed.',
    '- Rationale: the second fixture has a contract.',
    '- Verification (agent): review the second fixture.',
    '- Verification (target): run the second fixture.',
    '- Exceptions: none.',
    '',
  ].join('\n');

  assert.throws(
    () => validateRuleFile('fixture.md', fixture),
    /FIXTURE-FIRST-001 must have exactly one Incorrect example/,
  );
});

test('SHOULD rules may omit examples but cannot use placeholder verification', () => {
  const fixture = [
    '# Fixture',
    '',
    '### FIXTURE-SHOULD-001 [SHOULD]',
    '',
    '- Applies when: the fixture is changed.',
    '- Rationale: the convention improves reviewability.',
    '- Verification (agent): Check: run the fixture linter; Artifact: linter log; Pass: zero diagnostics.',
    '- Verification (target): Check: run the fixture build; Artifact: build log; Pass: target build succeeds.',
    '- Exceptions: generated files may follow their generator.',
    '',
  ].join('\n');

  assert.doesNotThrow(() => validateRuleFile('fixture.md', fixture));

  const placeholderFixture = fixture.replace(
    '- Verification (target): Check: run the fixture build; Artifact: build log; Pass: target build succeeds.',
    '- Verification (target): TBD',
  );
  assert.throws(
    () => validateRuleFile('fixture.md', placeholderFixture),
    /placeholder Verification \(target\)/,
  );
});
