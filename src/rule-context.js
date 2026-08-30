'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveRuleModuleIds } = require('./rule-catalog');

const CONTEXT_STAGES = ['route', 'summary', 'rules', 'evidence'];
const DEFAULT_CONTEXT_BUDGET = 6000;
const MAX_CONTEXT_BUDGET = 8000;
const BYTES_PER_ESTIMATED_TOKEN = 4;
const RULE_HEADING_PATTERN = /^###\s+(?<id>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,})(?:\s+\[(?<strength>MUST|SHOULD|MAY)\]|\s+\(Guidance; formerly \[(?<formerStrength>MUST|SHOULD|MAY)\]\))\s*$/gm;

function estimateTokens(text) {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / BYTES_PER_ESTIMATED_TOKEN);
}

function assertStage(stage) {
  if (!CONTEXT_STAGES.includes(stage)) {
    throw new Error(`Unknown context stage "${stage}". Use one of: ${CONTEXT_STAGES.join(', ')}.`);
  }
}

function normalizeSelector(values, label) {
  if (values === undefined) {
    return [];
  }
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`Context ${label} selectors must be non-empty strings.`);
  }
  return [...new Set(values)];
}

function sectionBetweenHeadings(content, heading) {
  const headingMatch = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(content);
  if (!headingMatch) {
    return '';
  }
  const sectionStart = headingMatch.index + headingMatch[0].length;
  const nextHeading = /^##\s+/m.exec(content.slice(sectionStart));
  const sectionEnd = nextHeading ? sectionStart + nextHeading.index : content.length;
  return content.slice(sectionStart, sectionEnd).trim();
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripEvidence(section) {
  return section
    .replace(/(^|\r?\n)- Verification \((?:agent|target)\):.*(?=\r?$)/gm, '')
    .replace(/(^|\r?\n)(?:Correct|Incorrect):\s*\r?\n\s*```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseRuleModule(content, module) {
  const titleMatch = /^#\s+(.+)$/m.exec(content);
  const rules = [];
  const matches = [...content.matchAll(RULE_HEADING_PATTERN)];

  matches.forEach((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    const section = content.slice(start, end).trim();
    const heading = match[0].trim();
    const appliesMatch = /^- Applies when:\s*(.+)$/m.exec(section);
    const requirement = section
      .slice(heading.length)
      .split(/\r?\n- Applies when:/, 1)[0]
      .trim();

    rules.push({
      id: match.groups.id,
      strength: match.groups.strength || 'GUIDANCE',
      formerStrength: match.groups.formerStrength || null,
      heading,
      appliesWhen: appliesMatch ? normalizeWhitespace(appliesMatch[1]) : '',
      requirement,
      full: section,
      rulesOnly: stripEvidence(section),
    });
  });

  return {
    id: module.id,
    path: module.path,
    status: module.status,
    title: titleMatch ? titleMatch[1].trim() : module.id,
    scope: normalizeWhitespace(sectionBetweenHeadings(content, 'Scope')),
    loadWhenText: normalizeWhitespace(sectionBetweenHeadings(content, 'Load when')),
    rules,
  };
}

function loadParsedModules(catalog, moduleIds, repositoryRoot) {
  const modulesById = new Map(catalog.modules.map((module) => [module.id, module]));
  return moduleIds.map((moduleId) => {
    const module = modulesById.get(moduleId);
    if (!module) {
      throw new Error(`Unknown resolved context module "${moduleId}".`);
    }
    const filePath = path.join(repositoryRoot, 'rules', module.path);
    const content = fs.readFileSync(filePath, 'utf8');
    return parseRuleModule(content, module);
  });
}

function renderRoute(profileId, signals, modules) {
  const lines = [
    `# Rule context route: ${profileId}`,
    '',
    `Signals: ${signals.length > 0 ? signals.join(', ') : 'none'}`,
    '',
    'Load in order:',
    '- Read PROJECT_RULES.md and the selected profile.',
    '- Load only the modules listed below when their task signal applies.',
    '- Read rule details and evidence in later stages.',
    '',
  ];
  for (const module of modules) {
    lines.push(`- ${module.id} [${module.status}] ${module.path}`);
  }
  return lines.join('\n');
}

function renderSummary(profileId, signals, modules) {
  const lines = [
    `# Rule context summary: ${profileId}`,
    '',
    `Signals: ${signals.length > 0 ? signals.join(', ') : 'none'}`,
    'Normative text remains in the canonical Markdown modules; this section is navigation only.',
    '',
  ];
  for (const module of modules) {
    lines.push(`## ${module.id} [${module.status}]`);
    lines.push(`Path: ${module.path}`);
    lines.push(`Load when: ${module.loadWhen.join(', ')}`);
    lines.push('Rules:');
    for (const rule of module.rules) {
      const strength = rule.formerStrength ? `GUIDANCE/${rule.formerStrength}` : rule.strength;
      lines.push(`- ${rule.id} [${strength}]`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function selectRules(modules, moduleSelectors, ruleSelectors) {
  const selectedModuleIds = new Set(moduleSelectors);
  const selectedRuleIds = new Set(ruleSelectors);
  const availableModuleIds = new Set(modules.map((module) => module.id));

  for (const moduleId of selectedModuleIds) {
    if (!availableModuleIds.has(moduleId)) {
      throw new Error(`Context module "${moduleId}" is not selected by the profile and signals.`);
    }
  }

  const selected = [];
  for (const module of modules) {
    if (selectedModuleIds.size > 0 && !selectedModuleIds.has(module.id)) {
      continue;
    }
    for (const rule of module.rules) {
      if (selectedRuleIds.size > 0 && !selectedRuleIds.has(rule.id)) {
        continue;
      }
      selected.push({ module, rule });
    }
  }

  const foundRuleIds = new Set(selected.map(({ rule }) => rule.id));
  for (const ruleId of selectedRuleIds) {
    if (!foundRuleIds.has(ruleId)) {
      throw new Error(`Context rule "${ruleId}" is not selected by the profile, signals, or module filters.`);
    }
  }
  return selected;
}

function renderRules(profileId, stage, selectedRules) {
  const lines = [`# Rule context ${stage}: ${profileId}`, ''];
  for (const { module, rule } of selectedRules) {
    const body = stage === 'evidence' ? rule.full : rule.rulesOnly;
    lines.push(`<!-- module: ${module.id}; rule: ${rule.id} -->`);
    lines.push(body);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function createBudgetError(stage, estimatedTokens, budgetTokens, selectedRules) {
  const error = new Error(
    `Context ${stage} requires about ${estimatedTokens} tokens, exceeding the ${budgetTokens}-token budget. Select fewer modules or rules; no rules were silently omitted.`,
  );
  error.code = 'CONTEXT_BUDGET_EXCEEDED';
  error.details = {
    stage,
    estimatedTokens,
    budgetTokens,
    selectedRules: selectedRules.map(({ module, rule }) => `${module.id}:${rule.id}`),
  };
  return error;
}

function buildRuleContext(catalog, profileId, signals = [], options = {}) {
  const {
    repositoryRoot = process.cwd(),
    allowDraft = false,
    stage = 'summary',
    budgetTokens = DEFAULT_CONTEXT_BUDGET,
  } = options;
  assertStage(stage);
  if (!Number.isInteger(budgetTokens) || budgetTokens <= 0 || budgetTokens > MAX_CONTEXT_BUDGET) {
    throw new Error(
      `Context budgetTokens must be a positive integer no greater than ${MAX_CONTEXT_BUDGET}.`,
    );
  }

  const moduleSelectors = normalizeSelector(options.moduleIds, 'module');
  const ruleSelectors = normalizeSelector(options.ruleIds, 'rule');
  const resolvedModuleIds = resolveRuleModuleIds(catalog, profileId, signals, {
    allowDraft,
    repositoryRoot,
  });
  const modules = loadParsedModules(catalog, resolvedModuleIds, repositoryRoot);

  let text;
  let selectedRules = [];
  if (stage === 'route') {
    text = renderRoute(profileId, signals, modules);
  } else if (stage === 'summary') {
    const catalogModules = new Map(catalog.modules.map((module) => [module.id, module]));
    text = renderSummary(profileId, signals, modules.map((module) => ({
      ...module,
      loadWhen: catalogModules.get(module.id).loadWhen,
    })));
  } else {
    selectedRules = selectRules(modules, moduleSelectors, ruleSelectors);
    text = renderRules(profileId, stage, selectedRules);
  }

  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens > budgetTokens) {
    throw createBudgetError(stage, estimatedTokens, budgetTokens, selectedRules);
  }

  return {
    profileId,
    signals: [...signals],
    stage,
    budgetTokens,
    estimatedTokens,
    modules: modules.map((module) => ({
      id: module.id,
      path: module.path,
      status: module.status,
      ruleCount: module.rules.length,
    })),
    selectedRules: selectedRules.map(({ module, rule }) => ({
      moduleId: module.id,
      ruleId: rule.id,
      strength: rule.formerStrength ? 'GUIDANCE' : rule.strength,
    })),
    text,
  };
}

module.exports = {
  CONTEXT_STAGES,
  DEFAULT_CONTEXT_BUDGET,
  MAX_CONTEXT_BUDGET,
  estimateTokens,
  buildRuleContext,
  parseRuleModule,
  stripEvidence,
};
