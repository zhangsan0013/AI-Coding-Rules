'use strict';

const fs = require('node:fs');
const path = require('node:path');

function readStatus(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const statusMatch = content.match(/^Status:\s*(\S+)\s*$/m);
  return statusMatch ? statusMatch[1] : null;
}

function indexEntries(entries, kind) {
  if (!Array.isArray(entries)) {
    throw new Error(`Catalog ${kind} must be an array.`);
  }

  const entriesById = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
      throw new Error(`Catalog ${kind} entries must have a non-empty id.`);
    }
    if (entriesById.has(entry.id)) {
      throw new Error(`Duplicate catalog ${kind} id "${entry.id}".`);
    }
    entriesById.set(entry.id, entry);
  }
  return entriesById;
}

function assertFile(repositoryRoot, relativePath, label) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) {
    throw new Error(`${label} path must be relative: ${relativePath || 'missing'}.`);
  }

  const rootPath = path.resolve(repositoryRoot);
  const fullPath = path.resolve(rootPath, relativePath);
  const relativeToRoot = path.relative(rootPath, fullPath);
  if (relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    throw new Error(`${label} path escapes the repository: ${relativePath}.`);
  }
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`${label} path does not exist: ${relativePath}.`);
  }
  return fullPath;
}

function assertStatusMatches(filePath, expectedStatus, label) {
  const actualStatus = readStatus(filePath);
  if (actualStatus !== expectedStatus) {
    throw new Error(`${label} status mismatch: catalog=${expectedStatus}, file=${actualStatus || 'missing'}.`);
  }
}

function assertActiveModuleHasRules(filePath, status, label) {
  if (status !== 'active') {
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const rulePattern = /^###\s+[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}\s+\[(?:MUST|SHOULD|MAY)\]\s*$/gm;
  if (!rulePattern.test(content)) {
    throw new Error(`${label} is active but contains no normative rules.`);
  }
}

function assertReferencesExist(references, entriesById, label) {
  if (!Array.isArray(references)) {
    throw new Error(`Catalog ${label} references must be an array.`);
  }
  for (const reference of references) {
    if (!entriesById.has(reference)) {
      throw new Error(`Catalog ${label} references unknown id "${reference}".`);
    }
  }
}

function validateInheritance(profilesById) {
  const visiting = new Set();
  const visited = new Set();

  function visit(profileId) {
    if (visiting.has(profileId)) {
      throw new Error(`Catalog profile inheritance cycle includes "${profileId}".`);
    }
    if (visited.has(profileId)) {
      return;
    }

    visiting.add(profileId);
    for (const parentId of profilesById.get(profileId).inherits) {
      visit(parentId);
    }
    visiting.delete(profileId);
    visited.add(profileId);
  }

  for (const profileId of profilesById.keys()) {
    visit(profileId);
  }
}

function validateRuleCatalog(catalog, repositoryRoot) {
  if (!catalog || catalog.schemaVersion !== 1) {
    throw new Error('Catalog schemaVersion must be 1.');
  }
  if (!Array.isArray(catalog.signals) || catalog.signals.some((signal) => typeof signal !== 'string')) {
    throw new Error('Catalog signals must be an array of strings.');
  }

  const signals = new Set(catalog.signals);
  if (signals.size !== catalog.signals.length) {
    throw new Error('Catalog signals must be unique.');
  }

  const modulesById = indexEntries(catalog.modules, 'modules');
  const profilesById = indexEntries(catalog.profiles, 'profiles');
  const modulePaths = new Set();

  for (const module of modulesById.values()) {
    if (!['active', 'draft'].includes(module.status)) {
      throw new Error(`Catalog module "${module.id}" has unsupported status "${module.status}".`);
    }
    if (!Array.isArray(module.loadWhen) || module.loadWhen.length === 0) {
      throw new Error(`Catalog module "${module.id}" must define loadWhen.`);
    }
    for (const signal of module.loadWhen) {
      if (signal !== 'always' && !signals.has(signal)) {
        throw new Error(`Catalog module "${module.id}" uses unknown signal "${signal}".`);
      }
    }
    if (module.loadWhen.includes('always') && module.loadWhen.length !== 1) {
      throw new Error(`Catalog module "${module.id}" cannot combine always with other signals.`);
    }
    assertReferencesExist(module.dependsOn, modulesById, `module "${module.id}"`);

    const modulePath = assertFile(path.join(repositoryRoot, 'rules'), module.path, `Module "${module.id}"`);
    assertStatusMatches(modulePath, module.status, `Module "${module.id}"`);
    assertActiveModuleHasRules(modulePath, module.status, `Module "${module.id}"`);
    if (modulePaths.has(module.path)) {
      throw new Error(`Duplicate catalog module path "${module.path}".`);
    }
    modulePaths.add(module.path);
  }

  const profilePaths = new Set();
  for (const profile of profilesById.values()) {
    if (!['active', 'draft'].includes(profile.status)) {
      throw new Error(`Catalog profile "${profile.id}" has unsupported status "${profile.status}".`);
    }
    assertReferencesExist(profile.inherits, profilesById, `profile "${profile.id}" inheritance`);
    assertReferencesExist(profile.baseline, modulesById, `profile "${profile.id}" baseline`);
    const profilePath = assertFile(path.join(repositoryRoot, 'profiles'), profile.path, `Profile "${profile.id}"`);
    assertStatusMatches(profilePath, profile.status, `Profile "${profile.id}"`);
    if (profilePaths.has(profile.path)) {
      throw new Error(`Duplicate catalog profile path "${profile.path}".`);
    }
    profilePaths.add(profile.path);
  }
  validateInheritance(profilesById);

  return { modulesById, profilesById };
}

function loadRuleCatalog(repositoryRoot) {
  const catalogPath = path.join(repositoryRoot, 'rules', 'catalog.json');
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read rule catalog ${catalogPath}: ${error.message}`);
  }
  validateRuleCatalog(catalog, repositoryRoot);
  return catalog;
}

function resolveRuleModuleIds(catalog, profileId, signals = [], options = {}) {
  const { modulesById, profilesById } = validateRuleCatalog(catalog, options.repositoryRoot || process.cwd());
  const allowDraft = options.allowDraft === true;
  if (!Array.isArray(signals)) {
    throw new Error('Resolver signals must be an array.');
  }

  const allowedSignals = new Set(catalog.signals);
  for (const signal of signals) {
    if (!allowedSignals.has(signal)) {
      throw new Error(`Unknown resolver signal "${signal}".`);
    }
  }

  const profile = profilesById.get(profileId);
  if (!profile) {
    throw new Error(`Unknown profile "${profileId}".`);
  }

  function assertUsable(entry, kind) {
    if (entry.status === 'draft' && !allowDraft) {
      throw new Error(`${kind} "${entry.id}" is draft. Pass --allow-draft for authoring or experimentation.`);
    }
  }

  const selected = new Set();
  const visitingProfiles = new Set();

  function addModule(moduleId) {
    if (selected.has(moduleId)) {
      return;
    }
    const module = modulesById.get(moduleId);
    if (!module) {
      throw new Error(`Unknown module "${moduleId}".`);
    }
    assertUsable(module, 'Module');
    for (const dependencyId of module.dependsOn) {
      addModule(dependencyId);
    }
    selected.add(moduleId);
  }

  function addProfile(currentProfileId) {
    if (visitingProfiles.has(currentProfileId)) {
      throw new Error(`Profile inheritance cycle includes "${currentProfileId}".`);
    }
    const currentProfile = profilesById.get(currentProfileId);
    if (!currentProfile) {
      throw new Error(`Unknown profile "${currentProfileId}".`);
    }
    assertUsable(currentProfile, 'Profile');
    visitingProfiles.add(currentProfileId);
    for (const parentId of currentProfile.inherits) {
      addProfile(parentId);
    }
    for (const moduleId of currentProfile.baseline) {
      addModule(moduleId);
    }
    visitingProfiles.delete(currentProfileId);
  }

  addProfile(profileId);
  for (const module of catalog.modules) {
    if (module.loadWhen.includes('always')) {
      addModule(module.id);
    }
  }
  for (const module of catalog.modules) {
    if (module.loadWhen.some((signal) => signals.includes(signal))) {
      addModule(module.id);
    }
  }

  return catalog.modules
    .filter((module) => selected.has(module.id))
    .map((module) => module.id);
}

module.exports = {
  loadRuleCatalog,
  resolveRuleModuleIds,
  validateRuleCatalog,
};
