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
let webLLMEngineFailed = false;

async function getWebLLMEngine() {
  if (webLLMEngineFailed) {
    const error = new Error("WebLLM failed to initialize earlier. Please refresh the page once your environment is ready.");
    log(error.message);
    throw error;
  }
  if (!webLLMEnginePromise) {
    if (typeof WebAssembly === "undefined") {
      const error = new Error("WebAssembly is required for WebLLM. Please use a modern browser that supports WebAssembly.");
      log(error.message);
      throw error;
    }
    if (!("gpu" in navigator)) {
      const error = new Error("WebGPU is required for WebLLM. Please enable WebGPU or switch to a browser with WebGPU support.");
      log(error.message);
      throw error;
    }
    const webLLMAPI = window.webllm;
    // WebLLM >=0.2.x exposes CreateMLCEngine; older builds exposed CreateEngine.
    const createEngine = webLLMAPI?.CreateMLCEngine || webLLMAPI?.CreateEngine;
    if (!createEngine || typeof createEngine !== "function") {
      const error = new Error("WebLLM library not loaded. Please refresh after the library finishes loading.");
      log(error.message);
      throw error;
    }
    // CreateMLCEngine is the current API; CreateEngine covers older library builds.
    webLLMEnginePromise = createEngine(MODEL, {
      initProgressCallback: (info) => {
        if (info?.text) {
          log("Model load: " + info.text);
        }
      }
    }).catch((err) => {
      log("Model load failed: " + err.toString());
      webLLMEngineFailed = true;
      throw err;
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
    messages: [{ role: "user", content: prompt }],
    stream: false,
    temperature: TEMPERATURE
  });

  return response.choices?.[0]?.message?.content || "";
}

// -----------------------------
// UTILS
// -----------------------------
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
