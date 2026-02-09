/*
Smoke test: Milestone E policy enforcement

Verifies:
- Chapter completion cannot be marked complete until passing required checkpoint assessment
- Course final assessment enforces maxAttempts (default 2)

Usage:
  node server/scripts/smoke_assessment_policy_enforcement.js

Assumptions:
- Local server listens on http://localhost:3000
- Login works for admin/local123
- Course title contains "Old Testament" and "Prophet" (fuzzy)
*/

const http = require('http');
const { spawn } = require('child_process');

function requestJson({ method, url, token, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;

    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
              }
            : {}),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch (_) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function startServer() {
  const child = spawn('node', ['server/server.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
  child.stderr.on('data', (d) => (stderr += d.toString('utf8')));

  // wait for listen
  for (let i = 0; i < 30; i++) {
    const probe = await requestJson({ method: 'GET', url: 'http://localhost:3000/api/courses', token: 'probe' }).catch(
      () => null
    );
    if (probe && (probe.status === 401 || probe.status === 403)) return { child, stdoutRef: () => stdout, stderrRef: () => stderr };
    await sleep(250);
  }

  child.kill('SIGTERM');
  throw new Error('Server did not start listening on :3000');
}

function fuzzyMatchCourse(courses) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const want = ['old', 'testament', 'prophet'];

  let best = null;
  let bestScore = -1;
  for (const c of courses || []) {
    const hay = norm(c.title);
    const score = want.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

async function main() {
  const baseUrl = 'http://localhost:3000';
  const { child } = await startServer();

  try {
    const uname = `smokepolicy${Date.now()}`;
    const pass = 'local123';

    const register = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/register`,
      body: { fname: 'Smoke', lname: 'Test', uname, pass },
    });

    if (register.status !== 200 || !register.body || !register.body.token) {
      throw new Error(`Register failed: ${register.status} ${JSON.stringify(register.body)}`);
    }

    const token = register.body.token;

    const coursesRes = await requestJson({ method: 'GET', url: `${baseUrl}/api/courses`, token });
    if (coursesRes.status !== 200) throw new Error(`Courses failed: ${coursesRes.status}`);

    const course = fuzzyMatchCourse(coursesRes.body);
    if (!course) throw new Error('No course found to test');

    const treeRes = await requestJson({ method: 'GET', url: `${baseUrl}/api/courses/${course.id}/content`, token });
    if (treeRes.status !== 200) throw new Error(`Content tree failed: ${treeRes.status}`);

    const tree = treeRes.body;
    const courseAssessments = Array.isArray(tree?.course?.assessments) ? tree.course.assessments : [];
    if (courseAssessments.length < 1) throw new Error('No course-level assessment attachment found');

    const finalAssessmentId = Number(courseAssessments[0].assessmentId);

    // pick first chapter with an attached assessment
    const lessons = Array.isArray(tree.lessons) ? tree.lessons : [];
    let chapter = null;
    let chapterAssessmentId = null;
    for (const l of lessons) {
      const chs = l && Array.isArray(l.chapters) ? l.chapters : [];
      const found = chs.find((c) => c && Array.isArray(c.assessments) && c.assessments.length > 0);
      if (found) {
        chapter = found;
        chapterAssessmentId = Number(found.assessments[0].assessmentId);
        break;
      }
    }

    if (!chapter || !Number.isFinite(chapterAssessmentId)) {
      throw new Error('No chapter-level checkpoint attachment found');
    }

    // 1) Chapter completion should be blocked before passing
    const mark1 = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/courses/${course.id}/progress`,
      token,
      body: { chapterId: String(chapter.id), status: 'completed' },
    });

    const chapterBlocked = mark1.status === 409;

    // 2) Post a passing attempt for the chapter assessment
    const passAttempt = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/assessment`,
      token,
      body: {
        username: uname,
        assessmentData: {
          id: chapterAssessmentId,
          title: 'Smoke Chapter Attempt',
          completedAt: new Date().toISOString(),
          scopeType: 'chapter',
          courseId: String(course.id),
          chapterId: String(chapter.id),
          score: 3,
          totalQuestions: 3,
          duration: 1,
          questions: [],
        },
      },
    });

    if (passAttempt.status !== 200) {
      throw new Error(`Posting chapter attempt failed: ${passAttempt.status} ${JSON.stringify(passAttempt.body)}`);
    }

    const mark2 = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/courses/${course.id}/progress`,
      token,
      body: { chapterId: String(chapter.id), status: 'completed' },
    });

    const chapterAllowedAfterPass = mark2.status === 200;

    // 3) Course final maxAttempts enforcement: submit 3 attempts, expect 3rd blocked
    // First, fetch the assessment with scope-aware params (this should pass before max attempts is reached).
    const getFinal1 = await requestJson({
      method: 'GET',
      url: `${baseUrl}/api/assessment?id=${encodeURIComponent(String(finalAssessmentId))}&scopeType=course&courseId=${encodeURIComponent(
        String(course.id)
      )}`,
      token,
    });

    const canStartFinal = getFinal1.status === 200;

    const attempt1 = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/assessment`,
      token,
      body: {
        username: uname,
        assessmentData: {
          id: finalAssessmentId,
          title: 'Smoke Final Attempt 1',
          completedAt: new Date().toISOString(),
          scopeType: 'course',
          courseId: String(course.id),
          score: 0,
          totalQuestions: 5,
          duration: 1,
          questions: [],
        },
      },
    });

    const attempt2 = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/assessment`,
      token,
      body: {
        username: uname,
        assessmentData: {
          id: finalAssessmentId,
          title: 'Smoke Final Attempt 2',
          completedAt: new Date().toISOString(),
          scopeType: 'course',
          courseId: String(course.id),
          score: 0,
          totalQuestions: 5,
          duration: 1,
          questions: [],
        },
      },
    });

    const attempt3 = await requestJson({
      method: 'POST',
      url: `${baseUrl}/api/assessment`,
      token,
      body: {
        username: uname,
        assessmentData: {
          id: finalAssessmentId,
          title: 'Smoke Final Attempt 3',
          completedAt: new Date().toISOString(),
          scopeType: 'course',
          courseId: String(course.id),
          score: 0,
          totalQuestions: 5,
          duration: 1,
          questions: [],
        },
      },
    });

    const thirdBlocked = attempt3.status === 409;

    // After consuming attempts, GET should be blocked too.
    const getFinal2 = await requestJson({
      method: 'GET',
      url: `${baseUrl}/api/assessment?id=${encodeURIComponent(String(finalAssessmentId))}&scopeType=course&courseId=${encodeURIComponent(
        String(course.id)
      )}`,
      token,
    });

    const getBlocked = getFinal2.status === 403;

    const ok = chapterBlocked && chapterAllowedAfterPass && canStartFinal && attempt1.status === 200 && attempt2.status === 200 && thirdBlocked && getBlocked;

    const summary = {
      ok,
      testUser: uname,
      course: { id: course.id, title: course.title },
      chapter: { id: String(chapter.id), title: chapter.title, assessmentId: chapterAssessmentId },
      finalAssessmentId,
      results: {
        markComplete_beforePass: { status: mark1.status, body: mark1.body },
        post_chapter_attempt: { status: passAttempt.status },
        markComplete_afterPass: { status: mark2.status },
        getFinal_beforeAttempts: { status: getFinal1.status },
        post_final_attempt1: { status: attempt1.status },
        post_final_attempt2: { status: attempt2.status },
        post_final_attempt3: { status: attempt3.status, body: attempt3.body },
        getFinal_afterAttempts: { status: getFinal2.status, body: getFinal2.body },
      },
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exit(ok ? 0 : 1);
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
