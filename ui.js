function log(msg) {
  const el = document.getElementById("log");
  el.textContent += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

function startAgent() {
  const goal = document.getElementById("goal").value;
  const githubToken = document.getElementById("token").value;
  const repo = document.getElementById("repo").value;
  const openaiKey = document.getElementById("openaiKey").value;

  if (!goal || !githubToken || !repo || !openaiKey) {
    log("Missing fields.");
    return;
  }

  agentLoop(goal, repo, githubToken, openaiKey);
}
