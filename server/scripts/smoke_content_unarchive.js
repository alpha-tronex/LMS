/*
  Smoke test for archiving/unarchiving LMS content (courses/lessons/chapters).

  Verifies:
    - Course can be archived + unarchived (status flips)
    - Chapter can be archived + unarchived (status flips)
    - Lesson archive cascades to chapters
    - Lesson unarchive cascades to chapters

  Runs a backend server on an ephemeral port, logs in as admin,
  then exercises the admin content endpoints.

  Usage:
    node server/scripts/smoke_content_unarchive.js

  Optional env vars:
    PORT (default 3102)
    ADMIN_UNAME (default admin)
    ADMIN_PASS (default local123)
*/

const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 3102);
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

function requireOk(result, message) {
  if (!result.ok) {
    throw new Error(`${message} (${result.status}): ${JSON.stringify(result.json)}`);
  }
}

function findById(items, id) {
  const s = String(id);
  return (items || []).find((x) => x && String(x.id) === s) || null;
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

    requireOk(login, 'Login failed');
    if (!login.json || !login.json.token) {
      throw new Error(`Login response missing token: ${JSON.stringify(login.json)}`);
    }

    const token = login.json.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1) Create course
    const unique = Date.now();
    const createdCourse = await fetchJson(`${BASE_URL}/api/admin/courses`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: `Smoke Unarchive Course ${unique}`, description: 'smoke' }),
    });

    if (createdCourse.status !== 201) {
      throw new Error(`Create course failed (${createdCourse.status}): ${JSON.stringify(createdCourse.json)}`);
    }

    const courseId = createdCourse.json && createdCourse.json.id;
    if (!courseId) throw new Error('Create course did not return id');

    // 2) Create lesson
    const createdLesson = await fetchJson(`${BASE_URL}/api/admin/courses/${encodeURIComponent(String(courseId))}/lessons`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: `Smoke Lesson ${unique}`, description: 'smoke', sortOrder: 1 }),
    });

    if (createdLesson.status !== 201) {
      throw new Error(`Create lesson failed (${createdLesson.status}): ${JSON.stringify(createdLesson.json)}`);
    }

    const lessonId = createdLesson.json && createdLesson.json.id;
    if (!lessonId) throw new Error('Create lesson did not return id');

    // 3) Create chapter
    const createdChapter = await fetchJson(`${BASE_URL}/api/admin/lessons/${encodeURIComponent(String(lessonId))}/chapters`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: `Smoke Chapter ${unique}`, sortOrder: 1, content: {} }),
    });

    if (createdChapter.status !== 201) {
      throw new Error(`Create chapter failed (${createdChapter.status}): ${JSON.stringify(createdChapter.json)}`);
    }

    const chapterId = createdChapter.json && createdChapter.json.id;
    if (!chapterId) throw new Error('Create chapter did not return id');

    // Helpers to read statuses (must includeArchived=1 to see archived items)
    async function listCourses() {
      const res = await fetchJson(`${BASE_URL}/api/admin/courses`, { headers: authHeaders });
      requireOk(res, 'List courses failed');
      return Array.isArray(res.json) ? res.json : [];
    }

    async function listLessons() {
      const res = await fetchJson(
        `${BASE_URL}/api/admin/courses/${encodeURIComponent(String(courseId))}/lessons?includeArchived=1`,
        { headers: authHeaders }
      );
      requireOk(res, 'List lessons failed');
      return Array.isArray(res.json) ? res.json : [];
    }

    async function listChapters() {
      const res = await fetchJson(
        `${BASE_URL}/api/admin/lessons/${encodeURIComponent(String(lessonId))}/chapters?includeArchived=1`,
        { headers: authHeaders }
      );
      requireOk(res, 'List chapters failed');
      return Array.isArray(res.json) ? res.json : [];
    }

    const initial = {
      course: findById(await listCourses(), courseId),
      lesson: findById(await listLessons(), lessonId),
      chapter: findById(await listChapters(), chapterId),
    };

    if (initial.course?.status !== 'active') throw new Error(`Expected course active; got ${initial.course?.status}`);
    if (initial.lesson?.status !== 'active') throw new Error(`Expected lesson active; got ${initial.lesson?.status}`);
    if (initial.chapter?.status !== 'active') throw new Error(`Expected chapter active; got ${initial.chapter?.status}`);

    // 4) Archive + unarchive chapter
    const archiveChapter = await fetchJson(`${BASE_URL}/api/admin/chapters/${encodeURIComponent(String(chapterId))}/archive`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    requireOk(archiveChapter, 'Archive chapter failed');

    const afterChapterArchive = findById(await listChapters(), chapterId);
    if (afterChapterArchive?.status !== 'archived') {
      throw new Error(`Expected chapter archived; got ${afterChapterArchive?.status}`);
    }

    const unarchiveChapter = await fetchJson(`${BASE_URL}/api/admin/chapters/${encodeURIComponent(String(chapterId))}/unarchive`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    requireOk(unarchiveChapter, 'Unarchive chapter failed');

    const afterChapterUnarchive = findById(await listChapters(), chapterId);
    if (afterChapterUnarchive?.status !== 'active') {
      throw new Error(`Expected chapter active after unarchive; got ${afterChapterUnarchive?.status}`);
    }

    // 5) Archive lesson (cascades chapter)
    const archiveLesson = await fetchJson(`${BASE_URL}/api/admin/lessons/${encodeURIComponent(String(lessonId))}/archive`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    requireOk(archiveLesson, 'Archive lesson failed');

    const afterLessonArchive = {
      lesson: findById(await listLessons(), lessonId),
      chapter: findById(await listChapters(), chapterId),
    };

    if (afterLessonArchive.lesson?.status !== 'archived') {
      throw new Error(`Expected lesson archived; got ${afterLessonArchive.lesson?.status}`);
    }
    if (afterLessonArchive.chapter?.status !== 'archived') {
      throw new Error(`Expected chapter archived via lesson cascade; got ${afterLessonArchive.chapter?.status}`);
    }

    // 6) Unarchive lesson (cascades chapter)
    const unarchiveLesson = await fetchJson(`${BASE_URL}/api/admin/lessons/${encodeURIComponent(String(lessonId))}/unarchive`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    requireOk(unarchiveLesson, 'Unarchive lesson failed');

    const afterLessonUnarchive = {
      lesson: findById(await listLessons(), lessonId),
      chapter: findById(await listChapters(), chapterId),
    };

    if (afterLessonUnarchive.lesson?.status !== 'active') {
      throw new Error(`Expected lesson active after unarchive; got ${afterLessonUnarchive.lesson?.status}`);
    }
    if (afterLessonUnarchive.chapter?.status !== 'active') {
      throw new Error(`Expected chapter active via lesson unarchive cascade; got ${afterLessonUnarchive.chapter?.status}`);
    }

    // 7) Archive + unarchive course
    const archiveCourse = await fetchJson(`${BASE_URL}/api/admin/courses/${encodeURIComponent(String(courseId))}/archive`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    requireOk(archiveCourse, 'Archive course failed');

    const afterCourseArchive = findById(await listCourses(), courseId);
    if (afterCourseArchive?.status !== 'archived') {
      throw new Error(`Expected course archived; got ${afterCourseArchive?.status}`);
    }

    const unarchiveCourse = await fetchJson(`${BASE_URL}/api/admin/courses/${encodeURIComponent(String(courseId))}/unarchive`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    requireOk(unarchiveCourse, 'Unarchive course failed');

    const afterCourseUnarchive = findById(await listCourses(), courseId);
    if (afterCourseUnarchive?.status !== 'active') {
      throw new Error(`Expected course active after unarchive; got ${afterCourseUnarchive?.status}`);
    }

    const out = {
      baseUrl: BASE_URL,
      courseId: String(courseId),
      lessonId: String(lessonId),
      chapterId: String(chapterId),
      ok: true,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
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
