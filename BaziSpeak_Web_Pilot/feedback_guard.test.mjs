import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsupportedPersonalFacts, groundExample } from './feedback_guard.mjs';

const prompt = 'You are meeting a new colleague. Introduce yourself and describe what you do.';
const transcript = "Hi there, my name's William. How are you?";

test('catches the actual v0.1 invented project manager and company', () => {
  const modelExample = "Hi there, my name's William. I'm a project manager at XYZ Company, and I help coordinate projects.";
  assert.equal(hasUnsupportedPersonalFacts(transcript, modelExample), true);
  const result = groundExample(prompt, transcript, modelExample);
  assert.equal(result.adjusted, true);
  assert.match(result.example, /\[your real job or field\]/);
  assert.doesNotMatch(result.example, /project manager|XYZ Company/);
  assert.match(result.example, /William/);
});

test('allows grounded sample using original information', () => {
  const original = 'Hi, my name is William. I work in student support at a tertiary institution.';
  const example = 'Hi, my name is William. I work in student support at a tertiary institution.';
  assert.equal(hasUnsupportedPersonalFacts(original, example), false);
});

test('flags an invented name', () => {
  assert.equal(hasUnsupportedPersonalFacts('Hello there', 'My name is Alice.'), true);
});

test('retains benign nonfactual improved examples', () => {
  const result = groundExample('Ask a staff member politely to find a classroom', 'Where is room B?', 'Excuse me, could you please tell me where room B is?');
  assert.equal(result.adjusted, false);
});

test('flags invented age', () => {
  assert.equal(hasUnsupportedPersonalFacts('Hello my name is William.', "Hello, my name is William. I'm 32 years old."), true);
});


test('v0.2 regression: role introduced with a where clause', () => {
  const output = 'Hi there, my name is William. I work as a project manager where I coordinate teams to deliver projects on time.';
  assert.equal(hasUnsupportedPersonalFacts(transcript, output), true);
  const safe = groundExample(prompt, transcript, output);
  assert.equal(safe.adjusted, true);
  assert.doesNotMatch(safe.example, /project manager|coordinate teams/i);
  assert.match(safe.example, /\[your real job or field\]/);
});

test('missing work detail triggers safe placeholders even when model avoids obvious role patterns', () => {
  const output = 'Hi, I am William, running a multimillion-dollar research laboratory in Wellington.';
  const safe = groundExample(prompt, transcript, output);
  assert.equal(safe.adjusted, true);
  assert.doesNotMatch(safe.example, /laboratory|Wellington/i);
  assert.match(safe.example, /\[what you actually do\]/);
});

test('work already given by learner is preserved', () => {
  const said = 'My name is William. I work in student support at a tertiary institution.';
  const model = 'Hi, my name is William. I work in student support at a tertiary institution.';
  const safe = groundExample(prompt, said, model);
  assert.equal(safe.adjusted, false);
  assert.equal(safe.example, model);
});

test('transcript is treated as speaker input not a reason to invent an unmentioned role', () => {
  const said = 'Hi there, my name is William. Nice to meet you.';
  const model = 'Hi there, my name is William. I am an experienced manager who leads a large team.';
  const safe = groundExample(prompt, said, model);
  assert.equal(safe.adjusted, true);
  assert.doesNotMatch(safe.example, /manager|team/i);
});
