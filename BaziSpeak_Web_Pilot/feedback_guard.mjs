// Safeguard for common invented personal facts in model-generated speaking examples.
// This is deliberately conservative. It is NOT a guarantee of factual accuracy.

const norm = (s) => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();

export function hasUnsupportedPersonalFacts(transcript, example) {
  const said = norm(transcript);
  const suggested = norm(example);
  if (!suggested) return true;

  // Don't introduce an occupation or employer that the learner never supplied.
  const rolePatterns = [
    /\b(?:i'm|i am)\s+(?:a|an)\s+([a-z][a-z\s-]{1,55}?)(?=\s+(?:at|for|where|who|and|with)\b|[,.;!?]|$)/g,
    /\bi work as\s+(?:a|an)?\s*([a-z][a-z\s-]{1,55}?)(?=\s+(?:at|for|where|who|and|with)\b|[,.;!?]|$)/g,
    /\bi work (?:in|at|for)\s+([a-z][a-z\s-]{2,55}?)(?=\s+(?:where|who|and|with)\b|[,.;!?]|$)/g,
  ];
  for (const pattern of rolePatterns) {
    for (const match of suggested.matchAll(pattern)) {
      const claim = norm(match[1]);
      if (claim && !said.includes(claim)) return true;
    }
  }

  // Names, ages, and named companies are personal facts rather than grammar edits.
  const nameInExample = suggested.match(/\bmy name(?:'s| is)\s+([a-z][a-z'-]{1,30})\b/);
  if (nameInExample && !said.includes(nameInExample[1])) return true;
  const ageInExample = suggested.match(/\bi(?:'m| am)\s+(\d{1,3})\s+years old\b/);
  if (ageInExample && !said.includes(ageInExample[1])) return true;
  const employer = suggested.match(/\b(?:at|for)\s+([a-z0-9][a-z0-9&.' -]{2,60}\b(?:company|university|school|ltd|inc))\b/);
  if (employer && !said.includes(norm(employer[1]))) return true;
  return false;
}

export function safeExampleForPrompt(prompt, transcript) {
  const task = norm(prompt);
  // A fill-in structure is intentionally not presented as the learner's real biography.
  if (task.includes('introduce yourself')) {
    const name = String(transcript).match(/\bmy name(?:'s| is)\s+([\p{L}'-]+)/iu)?.[1];
    return `Hi, my name is ${name || '[your name]'}. I work in [your real job or field]. My main responsibilities include [what you actually do]. Nice to meet you.`;
  }
  if (task.includes('work') && (task.includes('problem') || task.includes('issue'))) {
    return `I experienced [a real problem from your work]. I dealt with it by [what you actually did], and the result was [what happened].`;
  }
  if (task.includes('working from home') || task.includes('office')) {
    return `I prefer [your own preference] because [your actual reason]. For example, [a situation from your experience].`;
  }
  if (task.includes('classroom') || task.includes('ask a staff member')) {
    return `Excuse me, could you please tell me how to get to [the classroom you need]? Thank you.`;
  }
  if (task.includes('learned recently')) {
    return `Recently, I learned [what you learned]. It was useful because [your actual reason].`;
  }
  return `${String(transcript || '').trim()} [Add a real detail relevant to the task, using your own words.]`;
}

export function groundExample(prompt, transcript, modelExample) {
  // For personal introduction tasks, do not let the model invent a biography
  // when the learner only supplies a greeting and name. This deterministic
  // fallback closes gaps that a pattern-based hallucination filter can miss.
  const task = norm(prompt);
  const said = norm(transcript);
  const suppliedWork = /\b(?:i\s+(?:work|teach|manage|run|study|help|support)\b|i(?:'m| am)\s+(?:a|an)\s+\w+|my\s+(?:job|role|work|position|responsibilities)\b)/.test(said);
  if (task.includes('introduce yourself') && !suppliedWork) {
    return { example: safeExampleForPrompt(prompt, transcript), adjusted: true };
  }
  return hasUnsupportedPersonalFacts(transcript, modelExample)
    ? { example: safeExampleForPrompt(prompt, transcript), adjusted: true }
    : { example: modelExample, adjusted: false };
}
