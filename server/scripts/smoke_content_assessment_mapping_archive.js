/*
  Smoke test for Milestone F: content-assessment mappings are archived via status.

  Verifies:
    - Admin can attach an assessment mapping to a chapter scope
    - Student-facing course content tree includes only ACTIVE mappings
    - Detach archives the mapping (status=archived) and student tree hides it
    - Admin can unarchive an archived mapping and student tree shows it again

  Usage:
    node server/scripts/smoke_content_assessment_mapping_archive.js

  Optional env vars:
    PORT (default 3104)
    ADMIN_UNAME (default admin)
    ADMIN_PASS (default local123)
    ASSESSMENT_ID (default 0)
*/

const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 3104);
const BASE_URL = `http://localhost:${PORT}`;

const ADMIN_UNAME = process.env.ADMIN_UNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'local123';
const ASSESSMENT_ID = Number(process.env.ASSESSMENT_ID || 0);

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
  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uname: ADMIN_UNAME, pass: ADMIN_PASS }),
      });
      if (result.status !== 404 && result.status !== 502) return;
    } catch {
      // ignore
    }
    await sleep(200);
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${timeoutMs}ms`);
}

function requireOk(result, message) {
  if (!result.ok) {
    throw new Error(`${message} (${result.status}): ${JSON.stringify(result.json)}`);
  }
}

function findChapterAssessments(tree, chapterId) {
  const lessons = tree && Array.isArray(tree.lessons) ? tree.lessons : [];
  for (const lesson of lessons) {
    const chapters = lesson && Array.isArray(lesson.chapters) ? lesson.chapters : [];
    const found = chapters.find((c) => c && String(c.id) === String(chapterId));
    if (found) return Array.isArray(found.assessments) ? found.assessments : [];
  }
  return [];
}

async function main() {
  if (!Number.isFinite(ASSESSMENT_ID) || ASSESSMENT_ID < 0) {
    throw new Error(`Invalid ASSESSMENT_ID: ${process.env.ASSESSMENT_ID}`);
  }

  const serverProcess = spawn(process.execPath, ['server/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
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

    requireOk(login, 'Login failed');
    if (!login.json || !login.json.token) {
      throw new Error(`Login response missing token: ${JSON.stringify(login.json)}`);
    }

    const token = login.json.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const unique = Date.now();

    // Create course
    const createdCourse = await fetchJson(`${BASE_URL}/api/admin/courses`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Smoke Mapping Course ${unique}`, description: 'smoke' }),
    });
    if (createdCourse.status !== 201) {
      throw new Error(`Create course failed (${createdCourse.status}): ${JSON.stringify(createdCourse.json)}`);
    }
    const courseId = createdCourse.json && createdCourse.json.id;
    if (!courseId) throw new Error('Create course did not return id');

    // Create lesson
    const createdLesson = await fetchJson(
      `${BASE_URL}/api/admin/courses/${encodeURIComponent(String(courseId))}/lessons`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Smoke Lesson ${unique}`, description: 'smoke', sortOrder: 1 }),
      }
    );
    if (createdLesson.status !== 201) {
      throw new Error(`Create lesson failed (${createdLesson.status}): ${JSON.stringify(createdLesson.json)}`);
    }
    const lessonId = createdLesson.json && createdLesson.json.id;
    if (!lessonId) throw new Error('Create lesson did not return id');

    // Create chapter
    const createdChapter = await fetchJson(
      `${BASE_URL}/api/admin/lessons/${encodeURIComponent(String(lessonId))}/chapters`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Smoke Chapter ${unique}`, sortOrder: 1, content: {} }),
      }
    );
    if (createdChapter.status !== 201) {
      throw new Error(`Create chapter failed (${createdChapter.status}): ${JSON.stringify(createdChapter.json)}`);
    }
    const chapterId = createdChapter.json && createdChapter.json.id;
    if (!chapterId) throw new Error('Create chapter did not return id');

    // Attach mapping (chapter scope)
    const attach = await fetchJson(`${BASE_URL}/api/admin/content-assessments/attach`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeType: 'chapter', scopeId: chapterId, assessmentId: ASSESSMENT_ID }),
    });
    requireOk(attach, 'Attach mapping failed');

    // Student-facing tree includes active mapping
    const tree1 = await fetchJson(
      `${BASE_URL}/api/courses/${encodeURIComponent(String(courseId))}/content`,
      { headers: authHeaders }
    );
    requireOk(tree1, 'Get course content failed');

    const a1 = findChapterAssessments(tree1.json, chapterId);
    if (!a1.some((a) => a && Number(a.assessmentId) === ASSESSMENT_ID)) {
      throw new Error(`Expected attached assessment in course tree; got: ${JSON.stringify(a1)}`);
    }

    // Detach mapping (archives it)
    const detach = await fetchJson(`${BASE_URL}/api/admin/content-assessments/detach`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeType: 'chapter', scopeId: chapterId }),
    });
    requireOk(detach, 'Detach mapping failed');

    const tree2 = await fetchJson(
      `${BASE_URL}/api/courses/${encodeURIComponent(String(courseId))}/content`,
      { headers: authHeaders }
    );
    requireOk(tree2, 'Get course content after detach failed');

    const a2 = findChapterAssessments(tree2.json, chapterId);
    if (a2.some((a) => a && Number(a.assessmentId) === ASSESSMENT_ID)) {
      throw new Error(`Expected assessment hidden after detach; got: ${JSON.stringify(a2)}`);
    }

    // Confirm mapping exists as archived and unarchive it
    const list = await fetchJson(
      `${BASE_URL}/api/admin/content-assessments?includeArchived=1&courseId=${encodeURIComponent(String(courseId))}`,
      { headers: authHeaders }
    );
    requireOk(list, 'List mappings failed');

    const archived = (Array.isArray(list.json) ? list.json : []).find(
      (m) =>
        m &&
        m.status === 'archived' &&
        m.scopeType === 'chapter' &&
        String(m.scopeId) === String(chapterId) &&
        Number(m.assessmentId) === ASSESSMENT_ID
    );

    if (!archived || !archived.id) {
      throw new Error(`Expected archived mapping in list; got: ${JSON.stringify(list.json)}`);
    }

    const unarchive = await fetchJson(
      `${BASE_URL}/api/admin/content-assessments/${encodeURIComponent(String(archived.id))}/unarchive`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: '{}',
      }
    );
    requireOk(unarchive, 'Unarchive mapping failed');

    const tree3 = await fetchJson(
      `${BASE_URL}/api/courses/${encodeURIComponent(String(courseId))}/content`,
      { headers: authHeaders }
    );
    requireOk(tree3, 'Get course content after unarchive failed');

    const a3 = findChapterAssessments(tree3.json, chapterId);
    if (!a3.some((a) => a && Number(a.assessmentId) === ASSESSMENT_ID)) {
      throw new Error(`Expected assessment visible after unarchive; got: ${JSON.stringify(a3)}`);
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          baseUrl: BASE_URL,
          courseId,
          lessonId,
          chapterId,
          assessmentId: ASSESSMENT_ID,
          ok: true,
        },
        null,
        2
      )
    );
  } finally {
    serverProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
