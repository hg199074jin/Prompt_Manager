const assert = require('assert');
const {
  buildPromptMenuGroups,
  extractTemplateVariables,
  fillTemplateVariables,
  insertTextIntoValue
} = require('../context-menu-utils');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (error) {
    console.error('not ok - ' + name);
    throw error;
  }
}

test('buildPromptMenuGroups returns favorites, frequent, and recent prompts', () => {
  const prompts = [
    { id: 'a', title: 'Alpha', content: 'A', favorite: true, usageCount: 1, createdAt: 10 },
    { id: 'b', title: 'Beta', content: 'B', favorite: false, usageCount: 9, createdAt: 30 },
    { id: 'c', title: 'Gamma', content: 'C', favorite: false, usageCount: 4, createdAt: 20 }
  ];

  const groups = buildPromptMenuGroups(prompts, 2);

  assert.deepStrictEqual(groups.favorites.map(p => p.id), ['a']);
  assert.deepStrictEqual(groups.frequent.map(p => p.id), ['b', 'c']);
  assert.deepStrictEqual(groups.recent.map(p => p.id), ['b', 'c']);
});

test('extractTemplateVariables deduplicates and trims variable names', () => {
  assert.deepStrictEqual(
    extractTemplateVariables('写{{ 主题 }}，给{{受众}}，再写{{主题}}'),
    ['主题', '受众']
  );
});

test('fillTemplateVariables keeps empty values as placeholders and replaces filled values', () => {
  const result = fillTemplateVariables('写{{主题}}，给{{受众}}', {
    '主题': 'AI',
    '受众': ''
  });

  assert.strictEqual(result, '写AI，给{{受众}}');
});

test('insertTextIntoValue replaces selected range at cursor position', () => {
  const result = insertTextIntoValue('hello world', 'Prompt', 6, 11);

  assert.deepStrictEqual(result, {
    value: 'hello Prompt',
    selectionStart: 12,
    selectionEnd: 12
  });
});
