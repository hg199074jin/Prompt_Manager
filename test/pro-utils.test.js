const assert = require('assert');
const {
  fillEnhancedVariables,
  findSlashCommandTrigger,
  normalizeSlashCommand,
  parseEnhancedVariables,
  summarizeUsage
} = require('../pro-utils');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (error) {
    console.error('not ok - ' + name);
    throw error;
  }
}

test('parseEnhancedVariables supports labels, select options, and number defaults', () => {
  const variables = parseEnhancedVariables('写{{topic:请输入主题}}，语气{{tone|专业,口语}}，字数{{word_count:number:800}}');

  assert.deepStrictEqual(variables, [
    { name: 'topic', label: '请输入主题', type: 'text', defaultValue: '', options: [] },
    { name: 'tone', label: 'tone', type: 'select', defaultValue: '', options: ['专业', '口语'] },
    { name: 'word_count', label: 'word_count', type: 'number', defaultValue: '800', options: [] }
  ]);
});

test('fillEnhancedVariables replaces by variable name and keeps empty placeholders', () => {
  const result = fillEnhancedVariables('写{{topic:请输入主题}}，语气{{tone|专业,口语}}', {
    topic: 'AI 写作',
    tone: ''
  });

  assert.strictEqual(result, '写AI 写作，语气{{tone|专业,口语}}');
});

test('findSlashCommandTrigger matches command immediately before cursor', () => {
  const prompts = [
    { id: 'p1', title: 'Review', slashCommand: '/review' }
  ];
  const trigger = findSlashCommandTrigger('请帮我 /review', 12, prompts);

  assert.strictEqual(trigger.prompt.id, 'p1');
  assert.strictEqual(trigger.command, '/review');
  assert.strictEqual(trigger.start, 4);
  assert.strictEqual(trigger.end, 12);
});

test('normalizeSlashCommand trims, lowercases, and adds slash', () => {
  assert.strictEqual(normalizeSlashCommand(' Review Code '), '/review-code');
});

test('summarizeUsage counts events by prompt and host', () => {
  const summary = summarizeUsage([
    { promptId: 'a', host: 'chat.openai.com' },
    { promptId: 'a', host: 'chat.openai.com' },
    { promptId: 'b', host: 'claude.ai' }
  ]);

  assert.deepStrictEqual(summary, {
    total: 3,
    byPrompt: { a: 2, b: 1 },
    byHost: { 'chat.openai.com': 2, 'claude.ai': 1 }
  });
});
