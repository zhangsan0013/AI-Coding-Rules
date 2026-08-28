'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadRuleCatalog, resolveRuleModuleIds } = require('./rule-catalog');

const packageRoot = path.resolve(__dirname, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

const DEFAULT_PROFILE = 'bare-metal-c11';
const MANIFEST_FILE = '.install-manifest.json';
const MANAGED_PATHS = ['rules', 'profiles', 'templates', 'docs', 'checks', 'README.md'];
const AGENTS_BEGIN = '<!-- AI-CODING-RULES:BEGIN -->';
const AGENTS_END = '<!-- AI-CODING-RULES:END -->';

function parseArgs(argv) {
  const options = {
    command: null,
    profile: null,
    project: process.cwd(),
    dryRun: false,
    force: false,
    allowDraft: false,
    signals: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!options.command && !argument.startsWith('-')) {
      options.command = argument;
      continue;
    }
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--force') {
      options.force = true;
      continue;
    }
    if (argument === '--allow-draft') {
      options.allowDraft = true;
      continue;
    }
    const signalMatch = argument.match(/^--signal(?:=(.*))?$/);
    if (signalMatch) {
      options.signals.push(signalMatch[1] || argv[++index]);
      if (!options.signals[options.signals.length - 1]) {
        throw new Error('--signal requires a value.');
      }
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.command = 'help';
      continue;
    }
    if (argument === '--version' || argument === '-v') {
      options.command = 'version';
      continue;
    }

    const profileMatch = argument.match(/^--profile(?:=(.*))?$/);
    if (profileMatch) {
      options.profile = profileMatch[1] || argv[++index];
      if (!options.profile) {
        throw new Error('--profile requires a value.');
      }
      continue;
    }

    const projectMatch = argument.match(/^--project(?:=(.*))?$/);
    if (projectMatch) {
      options.project = projectMatch[1] || argv[++index];
      if (!options.project) {
        throw new Error('--project requires a value.');
      }
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function listProfiles() {
  return fs.readdirSync(path.join(packageRoot, 'profiles'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice(0, -3))
    .sort();
}

function readStatus(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const statusMatch = content.match(/^Status:\s*(\S+)\s*$/m);
  return statusMatch ? statusMatch[1] : null;
}

function assertProfile(profile, allowDraft) {
  if (!listProfiles().includes(profile)) {
    throw new Error(`Unknown profile "${profile}". Available profiles: ${listProfiles().join(', ')}`);
  }

  const status = readStatus(path.join(packageRoot, 'profiles', `${profile}.md`));
  if (status !== 'active' && status !== 'draft') {
    throw new Error(`Profile "${profile}" has unsupported status "${status || 'missing'}".`);
  }
  if (status === 'draft' && !allowDraft) {
    throw new Error(`Profile "${profile}" is draft. Pass --allow-draft for authoring or experimentation.`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}${os.EOL}`, 'utf8');
}

function pathExists(filePath) {
  return fs.existsSync(filePath);
}

function copyPath(sourcePath, destinationPath) {
  fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

function listFiles(rootPath) {
  const files = [];

  function visit(currentPath, relativePath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        visit(entryPath, entryRelativePath);
      } else if (entry.isFile()) {
        files.push(entryRelativePath.split(path.sep).join('/'));
      }
    }
  }

  visit(rootPath, '');
  return files.sort();
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshotManagedFiles(aiRulesPath) {
  const snapshot = {};

  for (const managedPath of MANAGED_PATHS) {
    const fullPath = path.join(aiRulesPath, managedPath);
    if (!pathExists(fullPath)) {
      continue;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      for (const relativePath of listFiles(fullPath)) {
        const manifestPath = path.join(managedPath, relativePath).split(path.sep).join('/');
        snapshot[manifestPath] = hashFile(path.join(fullPath, relativePath));
      }
    } else {
      snapshot[managedPath] = hashFile(fullPath);
    }
  }

  return snapshot;
}

function snapshotsEqual(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => (
    key === rightKeys[index] && left[key] === right[key]
  ));
}

function validateLocalLinks(rootPath) {
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const markdownFiles = listFiles(rootPath).filter((file) => file.endsWith('.md'));

  for (const relativeFile of markdownFiles) {
    const filePath = path.join(rootPath, relativeFile);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(linkPattern)) {
      const target = match[1].split('#', 1)[0];
      if (!target || target.startsWith('#') || /^[a-z]+:/i.test(target)) {
        continue;
      }
      const targetPath = path.resolve(path.dirname(filePath), target);
      if (!pathExists(targetPath)) {
        throw new Error(`Broken link in ${relativeFile}: ${target}`);
      }
    }
  }
}

function validateInstalledRules(aiRulesPath, profile) {
  const requiredPaths = [
    path.join(aiRulesPath, 'rules', 'INDEX.md'),
    path.join(aiRulesPath, 'profiles', `${profile}.md`),
    path.join(aiRulesPath, 'templates', 'AGENTS.md'),
    path.join(aiRulesPath, 'templates', 'PROJECT_RULES.md'),
  ];

  for (const requiredPath of requiredPaths) {
    if (!pathExists(requiredPath)) {
      throw new Error(`Installed rules are missing ${path.relative(aiRulesPath, requiredPath)}.`);
    }
  }
  validateLocalLinks(aiRulesPath);
  loadRuleCatalog(aiRulesPath);
}

function buildAgentsBlock(profile) {
  return [
    AGENTS_BEGIN,
    '## AI Coding Rules',
    '',
    'Before changing code in this project:',
    '',
    '1. Read `PROJECT_RULES.md` for verified project facts and approved exceptions.',
    '2. Read `.ai-rules/profiles/' + profile + '.md` for the selected project baseline.',
    '3. Read `.ai-rules/rules/INDEX.md` and load the always-required and task-specific modules.',
    '4. Cite materially applied rule IDs and report validation that was not run.',
    '',
    'Treat `.ai-rules/rules/` as the canonical general rule source. Do not load the legacy',
    '`.ai-rules/CODING_RULES.md` unless the task explicitly involves migrating it.',
    '',
    'Selected profile: `.ai-rules/profiles/' + profile + '.md`',
    AGENTS_END,
  ].join(os.EOL);
}

function mergeAgents(content, profile) {
  const block = buildAgentsBlock(profile);
  const blockPattern = new RegExp(`${escapeRegExp(AGENTS_BEGIN)}[\\s\\S]*?${escapeRegExp(AGENTS_END)}`);
  if (blockPattern.test(content)) {
    return content.replace(blockPattern, block);
  }
  if (content.length === 0) {
    return `${block}${os.EOL}`;
  }
  const prefix = content.length > 0 && !content.endsWith(os.EOL) ? os.EOL : '';
  return `${content}${prefix}${os.EOL}${block}${os.EOL}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProjectRules(profile) {
  const templatePath = path.join(packageRoot, 'templates', 'PROJECT_RULES.md');
  return fs.readFileSync(templatePath, 'utf8')
    .replace('`<select one profile under .ai-rules/profiles/>`', `\`${profile}\``);
}

function createManifest(aiRulesPath, profile) {
  return {
    schemaVersion: 1,
    package: packageInfo.name,
    version: packageInfo.version,
    profile,
    managedPaths: MANAGED_PATHS,
    files: snapshotManagedFiles(aiRulesPath),
    installedAt: new Date().toISOString(),
  };
}

function createStage(projectPath, currentAiRulesPath) {
  const stagePath = path.join(projectPath, `.ai-coding-rules-${crypto.randomUUID()}`);
  fs.mkdirSync(stagePath, { recursive: true });
  if (currentAiRulesPath && pathExists(currentAiRulesPath)) {
    copyPath(currentAiRulesPath, stagePath);
  }
  return stagePath;
}

function populateStage(stagePath, profile) {
  for (const managedPath of MANAGED_PATHS) {
    const sourcePath = path.join(packageRoot, managedPath);
    const destinationPath = path.join(stagePath, managedPath);
    if (!pathExists(sourcePath)) {
      throw new Error(`Package is missing managed path ${managedPath}.`);
    }
    fs.rmSync(destinationPath, { recursive: true, force: true });
    copyPath(sourcePath, destinationPath);
  }

  validateInstalledRules(stagePath, profile);
  writeJson(path.join(stagePath, MANIFEST_FILE), createManifest(stagePath, profile));
}

function replaceDirectory(destinationPath, stagePath) {
  const backupPath = `${destinationPath}.backup-${crypto.randomUUID()}`;
  const destinationExists = pathExists(destinationPath);
  if (destinationExists) {
    fs.renameSync(destinationPath, backupPath);
  }
  try {
    fs.renameSync(stagePath, destinationPath);
    if (destinationExists) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
  } catch (error) {
    if (pathExists(destinationPath)) {
      fs.rmSync(destinationPath, { recursive: true, force: true });
    }
    if (destinationExists && pathExists(backupPath)) {
      fs.renameSync(backupPath, destinationPath);
    }
    throw error;
  }
}

function updateSelectedProfile(content, profile) {
  const profilePattern = /(^## Selected profile\r?\n\r?\n)(`[^`\r\n]+`)/m;
  if (!profilePattern.test(content)) {
    throw new Error('Cannot switch profile because PROJECT_RULES.md has no recognizable Selected profile section.');
  }
  return content.replace(profilePattern, `$1\`${profile}\``);
}

function writeProjectFiles(projectPath, profile, dryRun, syncProfile) {
  const agentsPath = path.join(projectPath, 'AGENTS.md');
  const projectRulesPath = path.join(projectPath, 'PROJECT_RULES.md');
  const agentsBefore = pathExists(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  const agentsAfter = mergeAgents(agentsBefore, profile);
  const projectRulesExists = pathExists(projectRulesPath);
  const projectRulesBefore = projectRulesExists ? fs.readFileSync(projectRulesPath, 'utf8') : '';
  const projectRulesAfter = syncProfile
    ? updateSelectedProfile(projectRulesBefore, profile)
    : projectRulesBefore;
  const changes = [];

  if (!pathExists(agentsPath)) {
    changes.push('create AGENTS.md');
  } else if (agentsBefore !== agentsAfter) {
    changes.push('update the AI-CODING-RULES block in AGENTS.md');
  }
  if (!projectRulesExists) {
    changes.push('create PROJECT_RULES.md');
  } else if (projectRulesBefore !== projectRulesAfter) {
    changes.push('update the selected profile in PROJECT_RULES.md');
  }

  if (!dryRun) {
    fs.writeFileSync(agentsPath, agentsAfter, 'utf8');
    if (!projectRulesExists) {
      fs.writeFileSync(projectRulesPath, buildProjectRules(profile), 'utf8');
    } else if (projectRulesBefore !== projectRulesAfter) {
      fs.writeFileSync(projectRulesPath, projectRulesAfter, 'utf8');
    }
  }
  return changes;
}

function printPlan(command, projectPath, profile, changes) {
  console.log(`${command} plan for ${projectPath}`);
  console.log(`- profile: ${profile}`);
  for (const change of changes) {
    console.log(`- ${change}`);
  }
  if (changes.length === 0) {
    console.log('- no file changes required');
  }
}

function prepareAndInstall(projectPath, profile, command, options) {
  const aiRulesPath = path.join(projectPath, '.ai-rules');
  const exists = pathExists(aiRulesPath);
  if (command === 'init' && exists && !options.force) {
    throw new Error(`${aiRulesPath} already exists. Use "update" or pass --force to reinitialize it.`);
  }
  if (command === 'update' && !exists) {
    throw new Error(`${aiRulesPath} does not exist. Run "init" first.`);
  }

  const stagePath = createStage(projectPath, exists ? aiRulesPath : null);
  try {
    populateStage(stagePath, profile);
    const currentSnapshot = exists ? snapshotManagedFiles(aiRulesPath) : {};
    const manifestPath = path.join(aiRulesPath, MANIFEST_FILE);
    const previousManifest = exists && pathExists(manifestPath) ? readJson(manifestPath) : null;
    if (command === 'update' && !previousManifest) {
      throw new Error('Cannot update .ai-rules without .install-manifest.json. Use init --force to adopt it.');
    }
    if (command === 'update' && previousManifest && !snapshotsEqual(currentSnapshot, previousManifest.files || {}) && !options.force) {
      throw new Error('Managed .ai-rules files were modified locally. Review the changes or rerun with --force.');
    }

    const profileChanged = Boolean(previousManifest && previousManifest.profile !== profile);
    const changes = [exists ? `replace managed content in ${path.relative(projectPath, aiRulesPath)}` : 'create .ai-rules'];
    if (profileChanged) {
      changes.push(`change profile from ${previousManifest.profile} to ${profile}`);
    }
    changes.push(...writeProjectFiles(projectPath, profile, true, profileChanged));
    if (options.dryRun) {
      printPlan(command, projectPath, profile, changes);
      return;
    }

    replaceDirectory(aiRulesPath, stagePath);
    writeProjectFiles(projectPath, profile, false, profileChanged);
    console.log(`${command} complete: ${projectPath}`);
    console.log(`- profile: ${profile}`);
    console.log(`- package: ${packageInfo.name}@${packageInfo.version}`);
  } finally {
    if (pathExists(stagePath)) {
      fs.rmSync(stagePath, { recursive: true, force: true });
    }
  }
}

function printHelp() {
  console.log(`Usage: ai-coding-rules <command> [options]

Commands:
  init                         Initialize the current project.
  update                       Update installed managed rules.
  resolve                      Resolve module IDs for a profile and task signals.

Options:
  --profile <name>             Profile (default: ${DEFAULT_PROFILE} for init).
  --project <path>             Target project (default: current directory).
  --dry-run                    Show changes without writing files.
  --force                      Allow replacing locally modified managed rules.
  --allow-draft                Allow draft profiles during authoring or experimentation.
  --signal <name>              Add a task signal for the resolve command. Repeatable.
  --help                       Show this help.
  --version                    Show the package version.
`);
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.command === 'help' || options.command === null) {
    printHelp();
    return;
  }
  if (options.command === 'version') {
    console.log(packageInfo.version);
    return;
  }
  if (options.command === 'resolve') {
    const catalog = loadRuleCatalog(packageRoot);
    const profile = options.profile || DEFAULT_PROFILE;
    assertProfile(profile, options.allowDraft);
    const moduleIds = resolveRuleModuleIds(catalog, profile, options.signals, {
      allowDraft: options.allowDraft,
      repositoryRoot: packageRoot,
    });
    console.log(`resolve plan for profile ${profile}`);
    console.log(`- signals: ${options.signals.length > 0 ? options.signals.join(', ') : 'none'}`);
    console.log('- modules:');
    for (const moduleId of moduleIds) {
      const module = catalog.modules.find((entry) => entry.id === moduleId);
      console.log(`  - ${module.id} [${module.status}] ${module.path}`);
    }
    return;
  }
  if (!['init', 'update'].includes(options.command)) {
    throw new Error(`Unknown command "${options.command}". Use --help for usage.`);
  }

  const projectPath = path.resolve(options.project);
  if (!pathExists(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Project directory does not exist: ${projectPath}`);
  }

  const aiRulesPath = path.join(projectPath, '.ai-rules');
  let profile = options.profile;
  if (options.command === 'update' && !profile) {
    const manifestPath = path.join(aiRulesPath, MANIFEST_FILE);
    if (!pathExists(manifestPath)) {
      throw new Error('Update requires --profile when no installation manifest exists.');
    }
    profile = readJson(manifestPath).profile;
  }
  profile = profile || DEFAULT_PROFILE;
  assertProfile(profile, options.allowDraft);
  prepareAndInstall(projectPath, profile, options.command, options);
}

module.exports = {
  main,
  parseArgs,
  mergeAgents,
  snapshotManagedFiles,
};
