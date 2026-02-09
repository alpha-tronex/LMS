/* eslint-disable no-console */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpJson({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;

      const req = http.request(
        {
          method,
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + (u.search || ''),
          headers: {
            Accept: 'application/json',
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
            ...(headers || {}),
          },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            const status = res.statusCode || 0;
            const isJson = (res.headers['content-type'] || '').includes('application/json');
            let json = null;
            if (isJson) {
              try {
                json = data ? JSON.parse(data) : null;
              } catch {
                // ignore
              }
            }
            resolve({ status, headers: res.headers, text: data, json });
          });
        }
      );

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function waitForServer(baseUrl, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await httpJson({
        method: 'POST',
        url: `${baseUrl}/api/login`,
        body: { uname: '___probe___', pass: '___probe___' },
      });
      if (res.status > 0) return;
    } catch {
      // ignore
    }
    await sleep(200);
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickCourse(courses, desiredTitle) {
  const want = normalizeTitle(desiredTitle);
  const tokens = want.split(' ').filter(Boolean);

  // exact
  let found = courses.find((c) => normalizeTitle(c.title) === want);
  if (found) return found;

  // all tokens contained
  found = courses.find((c) => {
    const t = normalizeTitle(c.title);
    return tokens.every((tok) => t.includes(tok));
  });
  if (found) return found;

  // best overlap
  const scored = courses
    .map((c) => {
      const t = normalizeTitle(c.title);
      const score = tokens.reduce((acc, tok) => (t.includes(tok) ? acc + 1 : acc), 0);
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score >= 2) return scored[0].c;
  return null;
}

async function main() {
  const baseUrl = process.env.LMS_BASE_URL || 'http://localhost:3000';
  const adminUser = process.env.LMS_ADMIN_USER || 'admin';
  const adminPass = process.env.LMS_ADMIN_PASS || 'local123';
  const courseTitle = process.env.LMS_COURSE_TITLE || 'Essential Facts About Old Testament Prophets';

  const serverEntry = path.join(__dirname, '..', 'server.js');
  const serverProc = spawn(process.execPath, [serverEntry], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env },
  });

  let serverStdErr = '';
  serverProc.stderr.setEncoding('utf8');
  serverProc.stderr.on('data', (chunk) => {
    serverStdErr += chunk;
  });

  const cleanup = async () => {
    if (serverProc.exitCode !== null) return;
    serverProc.kill('SIGTERM');
    await sleep(250);
    if (serverProc.exitCode === null) serverProc.kill('SIGKILL');
  };

  try {
    await waitForServer(baseUrl, 8000);

    const login = await httpJson({
      method: 'POST',
      url: `${baseUrl}/api/login`,
      body: { uname: adminUser, pass: adminPass },
    });

    const token = login.json && login.json.token;
    if (!token) {
      throw new Error(`Login failed. status=${login.status} body=${login.text.slice(0, 300)}`);
    }

    const coursesRes = await httpJson({
      method: 'GET',
      url: `${baseUrl}/api/courses`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const courses = Array.isArray(coursesRes.json) ? coursesRes.json : [];
    const picked = pickCourse(courses, courseTitle);
    const courseId = picked && (picked._id || picked.id);
    if (!courseId) {
      throw new Error(`Could not find course for title “${courseTitle}”. courses_len=${courses.length}`);
    }

    const content = await httpJson({
      method: 'GET',
      url: `${baseUrl}/api/courses/${courseId}/content`,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!content.json) {
      throw new Error(`Content not JSON. status=${content.status} body=${content.text.slice(0, 200)}`);
    }

    const tree = content.json;
    const courseAssessments = Array.isArray(tree?.course?.assessments)
      ? tree.course.assessments
      : Array.isArray(tree.assessments)
        ? tree.assessments
        : [];
    const lessons = Array.isArray(tree.lessons) ? tree.lessons : [];

    const chapters = [];
    for (const lesson of lessons) {
      const lessonChapters = lesson && Array.isArray(lesson.chapters) ? lesson.chapters : [];
      for (const ch of lessonChapters) chapters.push(ch);
    }

    const chapterAttachmentCounts = chapters.map((ch) => {
      const a = ch && Array.isArray(ch.assessments) ? ch.assessments : [];
      return { chapterId: String(ch.id || ch._id || ''), chapterTitle: ch.title || '', len: a.length, assessmentIds: a.map((x) => x.assessmentId) };
    });

    const chaptersMissing = chapterAttachmentCounts.filter((x) => !x.chapterId || x.len <= 0);

    const allAssessmentIds = new Set();
    for (const ca of courseAssessments) {
      if (ca && Number.isFinite(Number(ca.assessmentId))) allAssessmentIds.add(Number(ca.assessmentId));
    }
    for (const ch of chapters) {
      const a = ch && Array.isArray(ch.assessments) ? ch.assessments : [];
      for (const it of a) {
        if (it && Number.isFinite(Number(it.assessmentId))) allAssessmentIds.add(Number(it.assessmentId));
      }
    }

    // Verify each referenced assessment can be fetched.
    const fetchChecks = [];
    for (const id of Array.from(allAssessmentIds.values()).sort((a, b) => a - b)) {
      const res = await httpJson({
        method: 'GET',
        url: `${baseUrl}/api/assessment?id=${encodeURIComponent(String(id))}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      const ok = res.status >= 200 && res.status < 300 && !!res.text;
      let title = null;
      try {
        const j = JSON.parse(res.text);
        title = j && j.title;
      } catch {
        // ignore
      }
      fetchChecks.push({ id, status: res.status, ok, title: title || null });
    }

    const okCourse = courseAssessments.length > 0;
    const okChapters = chapters.length > 0 && chaptersMissing.length === 0;
    const okFetch = fetchChecks.every((x) => x.ok);

    const result = {
      ok: okCourse && okChapters && okFetch,
      course: { id: String(courseId), title: picked.title },
      summary: {
        courseAssessmentsLen: courseAssessments.length,
        lessonsLen: lessons.length,
        chaptersLen: chapters.length,
        chaptersMissingAssessments: chaptersMissing.length,
        assessmentIdsReferenced: Array.from(allAssessmentIds.values()).sort((a, b) => a - b),
      },
      chaptersMissing: chaptersMissing.slice(0, 10),
      fetchChecks,
    };

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (err) {
    console.error(String(err && err.stack ? err.stack : err));
    if (serverStdErr) {
      console.error('--- server stderr (tail) ---');
      console.error(serverStdErr.slice(-1500));
    }
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main();
