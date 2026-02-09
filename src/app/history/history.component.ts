import { Component, OnInit } from '@angular/core';
import { CoursesService } from '@core/services/courses.service';
import { QuestionsService } from '@core/services/questions-service';
import { LoginService } from '@core/services/login-service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-history',
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.css'],
    standalone: false
})
export class HistoryComponent implements OnInit {
  assessments: any[] = [];
  groupedAssessments: Array<{
    key: string;
    courseId: string | null;
    scopeType: 'chapter' | 'lesson' | 'course' | 'unscoped';
    lessonId: string | null;
    chapterId: string | null;
    label: string;
    attempts: any[];
  }> = [];
  username: string = '';
  loading: boolean = true;
  error: string = '';

  private courseTitleById = new Map<string, string>();
  private lessonTitleById = new Map<string, string>();
  private chapterTitleById = new Map<string, string>();

  constructor(
    private coursesService: CoursesService,
    private questionsService: QuestionsService,
    private loginService: LoginService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    // Check if user is logged in using localStorage
    if (localStorage.getItem('currentUser')) {
      this.username = this.loginService.userName;
      if (this.username) {
        this.loadAssessmentHistory();
      } else {
        this.error = 'Unable to retrieve user information';
        this.loading = false;
      }
    } else {
      this.error = 'Please login to view your assessment history';
      this.loading = false;
    }
  }

  loadAssessmentHistory() {
    this.questionsService.getAssessmentHistory(this.username).subscribe({
      next: (data) => {
        this.assessments = data.assessments || [];
        this.groupedAssessments = this.groupAttempts(this.assessments);
        this.hydrateGroupTitles();
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error loading assessment history', error);
        this.error = 'Failed to load assessment history';
        this.loading = false;
      }
    });
  }

  private groupAttempts(attempts: any[]): Array<{
    key: string;
    courseId: string | null;
    scopeType: 'chapter' | 'lesson' | 'course' | 'unscoped';
    lessonId: string | null;
    chapterId: string | null;
    label: string;
    attempts: any[];
  }> {
    const list = Array.isArray(attempts) ? attempts : [];
    const map = new Map<string, any>();

    for (const a of list) {
      const scopeTypeRaw = a && typeof a.scopeType === 'string' ? String(a.scopeType) : '';
      const scopeType: 'chapter' | 'lesson' | 'course' | 'unscoped' =
        scopeTypeRaw === 'chapter' || scopeTypeRaw === 'lesson' || scopeTypeRaw === 'course'
          ? (scopeTypeRaw as any)
          : 'unscoped';

      const courseId = a && a.courseId ? String(a.courseId) : null;
      const lessonId = a && a.lessonId ? String(a.lessonId) : null;
      const chapterId = a && a.chapterId ? String(a.chapterId) : null;

      const key = `${courseId || 'none'}|${scopeType}|${lessonId || 'none'}|${chapterId || 'none'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          courseId,
          scopeType,
          lessonId,
          chapterId,
          label: this.formatGroupLabel({ courseId, scopeType, lessonId, chapterId }),
          attempts: [],
        });
      }
      map.get(key).attempts.push(a);
    }

    const groups = Array.from(map.values());

    // Sort attempts newest-first inside each group
    for (const g of groups) {
      g.attempts.sort((x: any, y: any) => {
        const tx = x && x.completedAt ? new Date(x.completedAt).getTime() : 0;
        const ty = y && y.completedAt ? new Date(y.completedAt).getTime() : 0;
        return ty - tx;
      });
    }

    // Sort groups by courseId then scopeType then chapterId/lessonId
    const scopeOrder: Record<string, number> = { course: 0, lesson: 1, chapter: 2, unscoped: 3 };
    groups.sort((a: any, b: any) => {
      const ca = a.courseId || '';
      const cb = b.courseId || '';
      if (ca !== cb) return ca.localeCompare(cb);

      const sa = scopeOrder[a.scopeType] ?? 99;
      const sb = scopeOrder[b.scopeType] ?? 99;
      if (sa !== sb) return sa - sb;

      const la = a.lessonId || '';
      const lb = b.lessonId || '';
      if (la !== lb) return la.localeCompare(lb);

      const cha = a.chapterId || '';
      const chb = b.chapterId || '';
      return cha.localeCompare(chb);
    });

    return groups;
  }

  private hydrateGroupTitles(): void {
    const groups = Array.isArray(this.groupedAssessments) ? this.groupedAssessments : [];
    const courseIds = Array.from(
      new Set(
        groups
          .map((g) => (g && g.courseId ? String(g.courseId) : null))
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    );

    if (courseIds.length === 0) return;

    let remaining = courseIds.length;
    for (const courseId of courseIds) {
      // Skip if already cached (e.g., revisiting the page)
      if (this.courseTitleById.has(courseId)) {
        remaining--;
        continue;
      }

      this.coursesService.getCourseContent(courseId).subscribe({
        next: (tree: any) => {
          const courseTitle = tree && tree.course && typeof tree.course.title === 'string' ? tree.course.title : '';
          if (courseTitle) {
            this.courseTitleById.set(courseId, courseTitle);
          }

          const lessons = tree && Array.isArray(tree.lessons) ? tree.lessons : [];
          for (const l of lessons) {
            if (l && l.id && typeof l.title === 'string') {
              this.lessonTitleById.set(String(l.id), l.title);
            }
            const chapters = l && Array.isArray(l.chapters) ? l.chapters : [];
            for (const c of chapters) {
              if (c && c.id && typeof c.title === 'string') {
                this.chapterTitleById.set(String(c.id), c.title);
              }
            }
          }

          this.refreshGroupLabels();
        },
        error: (err) => {
          // Non-blocking: keep showing IDs if we can't resolve titles.
          this.logger.error('Failed to load course content for history labels', err);
        },
        complete: () => {
          remaining--;
          if (remaining <= 0) {
            // Ensure labels are refreshed once at the end too.
            this.refreshGroupLabels();
          }
        },
      });
    }
  }

  private refreshGroupLabels(): void {
    const groups = Array.isArray(this.groupedAssessments) ? this.groupedAssessments : [];
    this.groupedAssessments = groups.map((g) => ({
      ...g,
      label: this.formatGroupLabel({
        courseId: g.courseId,
        scopeType: g.scopeType,
        lessonId: g.lessonId,
        chapterId: g.chapterId,
      }),
    }));
  }

  private formatGroupLabel(group: {
    courseId: string | null;
    scopeType: 'chapter' | 'lesson' | 'course' | 'unscoped';
    lessonId: string | null;
    chapterId: string | null;
  }): string {
    if (!group || group.scopeType === 'unscoped') return 'Other Attempts';

    const courseTitle = group.courseId ? this.courseTitleById.get(String(group.courseId)) : undefined;
    const coursePart = courseTitle ? courseTitle : group.courseId ? `Course ${group.courseId}` : 'Course';
    if (group.scopeType === 'course') return `${coursePart} — Final Assessment`;
    if (group.scopeType === 'lesson') {
      const lessonTitle = group.lessonId ? this.lessonTitleById.get(String(group.lessonId)) : undefined;
      const lessonPart = lessonTitle ? lessonTitle : group.lessonId ? `Lesson ${group.lessonId}` : 'Lesson';
      return `${coursePart} — ${lessonPart}`;
    }
    if (group.scopeType === 'chapter') {
      const chapterTitle = group.chapterId ? this.chapterTitleById.get(String(group.chapterId)) : undefined;
      const chapterPart = chapterTitle ? chapterTitle : group.chapterId ? `Chapter ${group.chapterId}` : 'Chapter';
      return `${coursePart} — ${chapterPart}`;
    }
    return coursePart;
  }

  getPercent(assessment: any): string {
    const pct =
      assessment && Number.isFinite(Number(assessment.percentScore))
        ? Number(assessment.percentScore)
        : assessment && Number.isFinite(Number(assessment.score)) && Number.isFinite(Number(assessment.totalQuestions)) && Number(assessment.totalQuestions) > 0
          ? (Number(assessment.score) / Number(assessment.totalQuestions)) * 100
          : null;

    return Number.isFinite(Number(pct)) ? `${Number(pct).toFixed(1)}%` : 'N/A';
  }

  trackGroup(_index: number, group: any): string {
    return group && group.key ? String(group.key) : String(_index);
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
