async function agentLoop(goal, repo, token) {
  log("Agent starting…");

  let state = {
    goal,
    repo,
    token,
    memory: [],
    step: 0
  };

  while (true) {
    state.step++;

    const thought = await callLLM(state, `
You are an autonomous coding agent.
Your goal: ${goal}

Available tools:
${Object.keys(tools).join(", ")}

State:
${JSON.stringify(state.memory)}

Decide the next best action.
Respond ONLY in JSON:
{ "tool": "tool_name", "args": { ... }, "note": "why" }
    `);

    log("Thought: " + thought);

    let action;
    try {
      action = JSON.parse(thought);
    } catch {
      log("Invalid JSON from model, retrying…");
      continue;
    }

    if (!tools[action.tool]) {
      log("Unknown tool: " + action.tool);
      continue;
    }

    log(`Executing tool: ${action.tool}`);
    const result = await tools[action.tool](action.args, state);

    state.memory.push({
      step: state.step,
      action,
      result
    });

    log("Result: " + JSON.stringify(result));

    await sleep(1500);
  }
}

async function callLLM(state, prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + state.token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
