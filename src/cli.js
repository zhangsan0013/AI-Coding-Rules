'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

function assertProfile(profile) {
  if (!listProfiles().includes(profile)) {
    throw new Error(`Unknown profile "${profile}". Available profiles: ${listProfiles().join(', ')}`);
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

function writeProjectFiles(projectPath, profile, dryRun) {
  const agentsPath = path.join(projectPath, 'AGENTS.md');
  const projectRulesPath = path.join(projectPath, 'PROJECT_RULES.md');
  const agentsBefore = pathExists(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  const agentsAfter = mergeAgents(agentsBefore, profile);
  const changes = [];

  if (!pathExists(agentsPath)) {
    changes.push('create AGENTS.md');
  } else if (agentsBefore !== agentsAfter) {
    changes.push('update the AI-CODING-RULES block in AGENTS.md');
  }
  if (!pathExists(projectRulesPath)) {
    changes.push('create PROJECT_RULES.md');
  }

  if (!dryRun) {
    fs.writeFileSync(agentsPath, agentsAfter, 'utf8');
    if (!pathExists(projectRulesPath)) {
      fs.writeFileSync(projectRulesPath, buildProjectRules(profile), 'utf8');
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

    const changes = [exists ? `replace managed content in ${path.relative(projectPath, aiRulesPath)}` : 'create .ai-rules'];
    if (previousManifest && previousManifest.profile !== profile) {
      changes.push(`change profile from ${previousManifest.profile} to ${profile}`);
    }
    changes.push(...writeProjectFiles(projectPath, profile, true));
    if (options.dryRun) {
      printPlan(command, projectPath, profile, changes);
      return;
    }

    replaceDirectory(aiRulesPath, stagePath);
    writeProjectFiles(projectPath, profile, false);
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

Options:
  --profile <name>             Profile (default: ${DEFAULT_PROFILE} for init).
  --project <path>             Target project (default: current directory).
  --dry-run                    Show changes without writing files.
  --force                      Allow replacing locally modified managed rules.
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
  assertProfile(profile);
  prepareAndInstall(projectPath, profile, options.command, options);
}

module.exports = {
  main,
  parseArgs,
  mergeAgents,
  snapshotManagedFiles,
};
