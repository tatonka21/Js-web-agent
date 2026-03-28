// -----------------------------
// JSON SANITIZER
// -----------------------------
function extractJSON(text) {
  if (!text) return null;

  try { return JSON.parse(text); } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  try {
    const fixed = text.replace(/'/g, '"');
    return JSON.parse(fixed);
  } catch {}

  return null;
}

// -----------------------------
// INITIALIZE WEBLLM
// -----------------------------
let webllm = null;
let webllmReady = false;

async function initWebLLM() {
  if (webllmReady) return;

  log("Loading WebLLM model (first load may take 10–30 seconds)…");

  webllm = await webllmInit({
    model: WEBLLM_MODEL
  });

  webllmReady = true;
  log("WebLLM model loaded!");
}

// -----------------------------
// MAIN AGENT LOOP
// -----------------------------
async function agentLoop(goal, repo) {
  await initWebLLM();

  log("Agent starting…");

  let state = {
    goal,
    repo,
    memory: [],
    step: 0
  };

  while (true) {
    state.step++;

    // THINK
    const prompt = `
You are an autonomous coding agent running entirely in the browser using WebLLM.

Your mission:
- Understand the user's goal
- Choose the correct tool
- Perform one action at a time
- Move the project forward
- Keep responses short and always valid JSON

RULES:
- Respond ONLY with valid JSON
- NO backticks
- NO explanations outside JSON
- JSON format:
{
  "tool": "tool_name",
  "args": { ... },
  "note": "short explanation"
}

Goal: ${goal}

Available tools:
${Object.keys(tools).join(", ")}

Memory:
${JSON.stringify(state.memory)}
`;

    const thought = await callWebLLM(prompt);
    log("Thought: " + thought);

    // PARSE JSON
    let action = extractJSON(thought);

    if (!action) {
      log("Invalid JSON from model, retrying…");
      continue;
    }

    if (!tools[action.tool]) {
      log("Unknown tool: " + action.tool);
      continue;
    }

    // ACT
    log(`Executing tool: ${action.tool}`);

    let result;
    try {
      result = await tools[action.tool](action.args, state);
    } catch (err) {
      result = { error: err.toString() };
    }

    // REFLECT
    state.memory.push({
      step: state.step,
      action,
      result
    });

    log("Result: " + JSON.stringify(result));

    await sleep(1500);
  }
}

// -----------------------------
// CALL WEBLLM
// -----------------------------
async function callWebLLM(prompt) {
  const reply = await webllm.chat.completions.create({
    messages: [{ role: "user", content: prompt }]
  });

  return reply.choices?.[0]?.message?.content || "";
}

// -----------------------------
// UTILS
// -----------------------------
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
