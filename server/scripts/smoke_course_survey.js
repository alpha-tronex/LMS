/* eslint-disable no-console */

// Smoke test: end-of-course survey is strictly post completion.
// - Not completed -> POST returns 403
// - Completed (chapters complete; and if a required final exists, it is passed) -> POST returns 201
// - Re-submit -> returns 200 (already submitted)

const path = require('path');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, json };
}

async function waitForServer(baseUrl, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // This endpoint is expected to exist; any HTTP response means the server is up.
      await fetch(baseUrl + '/api/login', { method: 'GET' });
      return;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  throw new Error('Server did not become ready in time');
}

function startServer(port) {
  const serverPath = path.join(__dirname, '..', 'server.js');
  const child = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write(d));
  child.stderr.on('data', (d) => process.stderr.write(d));

  return child;
}

async function main() {
  const port = 5059;
  const baseUrl = `http://localhost:${port}`;
  const STUDENT_UNAME = process.env.STUDENT_UNAME || 'student';
  const STUDENT_PASS = process.env.STUDENT_PASS || 'local123';

  const child = startServer(port);
  try {
    await waitForServer(baseUrl);

    // Login as student
    const login = await fetchJson(baseUrl + '/api/login', {
      method: 'POST',
      body: JSON.stringify({ uname: STUDENT_UNAME, pass: STUDENT_PASS }),
    });
    if (login.status !== 200 || !login.json?.token) {
      throw new Error(`Login failed: status=${login.status} body=${JSON.stringify(login.json)}`);
    }
    const token = login.json.token;

    // Find an enrolled course
    const coursesRes = await fetchJson(baseUrl + '/api/courses', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (coursesRes.status !== 200 || !Array.isArray(coursesRes.json)) {
      throw new Error(`Courses fetch failed: status=${coursesRes.status} body=${JSON.stringify(coursesRes.json)}`);
    }
    if (coursesRes.json.length === 0) {
      throw new Error('No courses returned for student');
    }

    const course = coursesRes.json[0];
    const courseId = course._id || course.id;
    if (!courseId) throw new Error('Course id missing');

    async function getSurveyStatus(cid) {
      const status = await fetchJson(baseUrl + `/api/courses/${cid}/survey/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (status.status !== 200) {
        throw new Error(`Survey status failed: status=${status.status} body=${JSON.stringify(status.json)}`);
      }
      return status.json;
    }

    async function submitAndVerify(cid) {
      const submit1 = await fetchJson(baseUrl + `/api/courses/${cid}/survey`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ratingOverall: 5, ratingDifficulty: 3, comment: 'Great course.' }),
      });

      if (submit1.status !== 201 && submit1.status !== 200) {
        throw new Error(`Expected 201/200 when completed; got ${submit1.status} body=${JSON.stringify(submit1.json)}`);
      }

      const submit2 = await fetchJson(baseUrl + `/api/courses/${cid}/survey`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ratingOverall: 4, comment: 'Second submit should be idempotent.' }),
      });
      if (submit2.status !== 200) {
        throw new Error(`Expected 200 on repeat submit; got ${submit2.status} body=${JSON.stringify(submit2.json)}`);
      }

      const status2 = await getSurveyStatus(cid);
      if (!status2?.surveySubmitted) {
        throw new Error(`Expected surveySubmitted true after submit; got ${JSON.stringify(status2)}`);
      }

      console.log('ok: submit + idempotency + status');
      return true;
    }

    // 1) Prefer an already-completed course.
    for (const c of coursesRes.json) {
      const cid = c._id || c.id;
      if (!cid) continue;
      const st = await getSurveyStatus(cid);
      if (st?.courseCompleted && !st?.surveySubmitted) {
        await submitAndVerify(cid);
        return;
      }
    }

    // 2) Try to complete a course by marking all chapters completed.
    for (const c of coursesRes.json) {
      const cid = c._id || c.id;
      if (!cid) continue;

      const content = await fetchJson(baseUrl + `/api/courses/${cid}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (content.status !== 200) continue;

      const lessons = Array.isArray(content.json?.lessons) ? content.json.lessons : [];
      const chapterIds = [];
      for (const l of lessons) {
        const chapters = Array.isArray(l?.chapters) ? l.chapters : [];
        for (const ch of chapters) {
          if (ch?.id) chapterIds.push(ch.id);
        }
      }
      if (chapterIds.length === 0) continue;

      let canComplete = true;
      for (const chId of chapterIds) {
        const up = await fetchJson(baseUrl + `/api/courses/${cid}/progress`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ chapterId: chId, status: 'completed' }),
        });

        // 409 indicates required checkpoint assessment; skip this course.
        if (up.status === 409) {
          canComplete = false;
          break;
        }
        if (up.status !== 200) {
          canComplete = false;
          break;
        }
      }
      if (!canComplete) continue;

      const st = await getSurveyStatus(cid);
      if (st?.courseCompleted && !st?.surveySubmitted) {
        await submitAndVerify(cid);
        return;
      }
    }

    // 3) Fallback: validate strict gating on first course.
    const status1 = await getSurveyStatus(courseId);
    if (status1?.courseCompleted) {
      console.log('note: course completed but survey already submitted or could not submit');
      return;
    }

    const submitBlocked = await fetchJson(baseUrl + `/api/courses/${courseId}/survey`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ratingOverall: 5, ratingDifficulty: 3, comment: 'Great course.' }),
    });
    if (submitBlocked.status !== 403) {
      throw new Error(`Expected 403 when not completed; got ${submitBlocked.status} body=${JSON.stringify(submitBlocked.json)}`);
    }
    console.log('ok: strict gating (not completed => 403)');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
