const tools = {
  read_file: async ({ path }, state) => {
    const url = `https://api.github.com/repos/${state.repo}/contents/${path}`;
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + state.githubToken }
    });
    const data = await res.json();
    if (data.content) {
      return atob(data.content);
    }
    return null;
  },

  write_file: async ({ path, content, message }, state) => {
    const url = `https://api.github.com/repos/${state.repo}/contents/${path}`;

    let sha = null;
    const existing = await fetch(url, {
      headers: { Authorization: "Bearer " + state.githubToken }
    });
    if (existing.status === 200) {
      const json = await existing.json();
      sha = json.sha;
    }

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + state.githubToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        content: btoa(content),
        sha
      })
    });

    return await res.json();
  },

  create_pr: async ({ branch, title, body }, state) => {
    const url = `https://api.github.com/repos/${state.repo}/pulls`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + state.githubToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: "main"
      })
    });

    return await res.json();
  }
};
