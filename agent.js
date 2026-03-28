// -----------------------------
// JSON SANITIZER (GLOBAL)
// -----------------------------
function extractJSON(text) {
  if (!text) return null;

  // 1. Try direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // 2. Extract first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  // 3. Replace single quotes with double quotes
  try {
    const fixed = text.replace(/'/g, '"');
    return JSON.parse(fixed);
  } catch {}

  return null;
}

// -----------------------------
// MAIN AGENT LOOP
// -----------------------------
async function agentLoop(goal, repo, githubToken) {
  log("Agent starting…");

  let state = {
    goal,
    repo,
    githubToken,
    memory: [],
    step: 0
  };

  while (true) {
    state.step++;

    // -----------------------------
    // THINK
    // -----------------------------
    const thought = await callLLM(state, `
You are an autonomous coding agent running entirely in the browser.

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
    `);

    log("Thought: " + thought);

    // -----------------------------
    // PARSE JSON SAFELY
    // -----------------------------
    let action = extractJSON(thought);

    if (!action) {
      log("Invalid JSON from model, retrying…");
      continue;
    }

    if (!tools[action.tool]) {
      log("Unknown tool: " + action.tool);
      continue;
    }

    // -----------------------------
    // ACT
    // -----------------------------
    log(`Executing tool: ${action.tool}`);

    let result;
    try {
      result = await tools[action.tool](action.args, state);
    } catch (err) {
      result = { error: err.toString() };
    }

    // -----------------------------
    // REFLECT
    // -----------------------------
    state.memory.push({
      step: state.step,
      action,
      result
    });

    log("Result: " + JSON.stringify(result));

    // Slow down loop slightly
    await sleep(1500);
  }
}

let webLLMEnginePromise;

async function getWebLLMEngine() {
  if (!webLLMEnginePromise) {
    webLLMEnginePromise = webllm.CreateMLCEngine(MODEL, {
      initProgressCallback: (info) => {
        if (info?.text) {
          log("Model load: " + info.text);
        }
      }
    });
  }
  return webLLMEnginePromise;
}

// -----------------------------
// LLM CALL
// -----------------------------
async function callLLM(state, prompt) {
  const engine = await getWebLLMEngine();
  const response = await engine.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: false,
    temperature: 0.2
  });

  return response.choices?.[0]?.message?.content || "";
}

// -----------------------------
// UTILS
// -----------------------------
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
