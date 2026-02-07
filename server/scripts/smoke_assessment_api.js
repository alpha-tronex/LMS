/*
  Smoke test for LMS assessment APIs.

  Runs a backend server on an ephemeral port, logs in as admin,
  then exercises list/upload/fetch/delete endpoints.

  Usage:
    node server/scripts/smoke_assessment_api.js

  Optional env vars:
    PORT (default 3101)
    ADMIN_UNAME (default admin)
    ADMIN_PASS (default local123)
*/

const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 3101);
const BASE_URL = `http://localhost:${PORT}`;

const ADMIN_UNAME = process.env.ADMIN_UNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'local123';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _nonJsonBody: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function waitForServerReady({ timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  // We don't have a health endpoint; just retry login until it responds.
  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uname: ADMIN_UNAME, pass: ADMIN_PASS }),
      });
      if (result.status !== 404 && result.status !== 502) {
        return;
      }
    } catch {
      // ignore until ready
    }
    await sleep(200);
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${timeoutMs}ms`);
}

async function main() {
  const serverProcess = spawn(process.execPath, ['server/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  serverProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  serverProcess.on('exit', (code) => {
    if (code && code !== 0) {
      // eslint-disable-next-line no-console
      console.error(`Server exited with code ${code}`);
    }
  });

  try {
    await waitForServerReady({ timeoutMs: 5000 });

    const login = await fetchJson(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uname: ADMIN_UNAME, pass: ADMIN_PASS }),
    });

    if (!login.ok || !login.json || !login.json.token) {
      throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.json)}`);
    }

    const token = login.json.token;

    const listBefore = await fetchJson(`${BASE_URL}/api/assessment/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listBefore.ok || !Array.isArray(listBefore.json)) {
      throw new Error(`List before failed (${listBefore.status}): ${JSON.stringify(listBefore.json)}`);
    }

    const payload = {
      title: `Smoke Test Assessment ${Date.now()}`,
      questions: [
        {
          questionNum: 0,
          questionType: 'SingleAnswer',
          instructions: 'Pick one',
          question: '2+2?',
          answers: ['3', '4'],
          correct: [2],
        },
      ],
    };

    const upload = await fetchJson(`${BASE_URL}/api/assessment/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!upload.ok || typeof upload.json?.assessmentId !== 'number') {
      throw new Error(`Upload failed (${upload.status}): ${JSON.stringify(upload.json)}`);
    }

    const newId = upload.json.assessmentId;

    const listAfter = await fetchJson(`${BASE_URL}/api/assessment/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const fetched = await fetchJson(`${BASE_URL}/api/assessment?id=${encodeURIComponent(String(newId))}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const deleted = await fetchJson(`${BASE_URL}/api/assessment/delete/${encodeURIComponent(String(newId))}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const listFinal = await fetchJson(`${BASE_URL}/api/assessment/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const out = {
      baseUrl: BASE_URL,
      listBeforeLen: listBefore.json.length,
      uploadAssessmentId: newId,
      listAfterHasNewId: Array.isArray(listAfter.json)
        ? listAfter.json.some((x) => String(x.id) === String(newId))
        : null,
      fetchedTitle: fetched.json?.title,
      fetchedId: fetched.json?.id,
      deleteMessage: deleted.json?.message,
      listFinalStillHasNewId: Array.isArray(listFinal.json)
        ? listFinal.json.some((x) => String(x.id) === String(newId))
        : null,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));

    if (!out.listAfterHasNewId) {
      throw new Error('Uploaded assessment did not appear in admin list');
    }
    if (String(out.fetchedId) !== String(newId)) {
      throw new Error('Fetched assessment id mismatch');
    }
    if (out.listFinalStillHasNewId) {
      throw new Error('Deleted assessment still appears in admin list');
    }
  } finally {
    serverProcess.kill('SIGTERM');
    await sleep(300);
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }

    if (stderr.trim()) {
      // eslint-disable-next-line no-console
      console.error('--- server stderr (tail) ---');
      // eslint-disable-next-line no-console
      console.error(stderr.split('\n').slice(-20).join('\n'));
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
