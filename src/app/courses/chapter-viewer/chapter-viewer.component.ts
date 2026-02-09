import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoursesService } from '@core/services/courses.service';
import { ChapterAsset, ChapterDetail, ChapterPage } from '@models/course-content';
import { ChapterProgressStatus } from '@models/chapter-progress';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-chapter-viewer',
  templateUrl: './chapter-viewer.component.html',
  styleUrls: ['./chapter-viewer.component.css'],
  standalone: false,
})
export class ChapterViewerComponent implements OnInit {
  courseId = '';
  chapterId = '';

  loading = true;
  error = '';

  chapter: ChapterDetail | null = null;

  pageIndex = 0; // 0-based

  private progressUpdating = false;

  progressStatus: ChapterProgressStatus = 'not_started';
  markingComplete = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coursesService: CoursesService,
    private logger: LoggerService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('currentUser')) {
      this.error = 'Please login to view chapter content.';
      this.loading = false;
      return;
    }

    const courseId = this.route.snapshot.paramMap.get('courseId');
    const chapterId = this.route.snapshot.paramMap.get('chapterId');

    if (!courseId || !chapterId) {
      this.error = 'Missing course/chapter id.';
      this.loading = false;
      return;
    }

    this.courseId = courseId;
    this.chapterId = chapterId;

    this.route.queryParams.subscribe((params) => {
      const raw = params && params['page'] !== undefined ? Number(params['page']) : 1;
      const safe = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
      this.pageIndex = safe - 1;
      // If chapter already loaded, clamp page in case count changed
      this.clampPageIndex();

      // If chapter is loaded, upsert progress based on current page
      this.updateProgressForCurrentPage();
    });

    this.loadChapter();
  }

  private loadChapter(): void {
    this.loading = true;
    this.error = '';

    this.coursesService.getChapter(this.chapterId).subscribe({
      next: (detail) => {
        this.chapter = detail;
        this.loading = false;
        this.clampPageIndex();
        this.loadProgressStatus();
        this.updateProgressForCurrentPage();
      },
      error: (err) => {
        this.logger.error('Failed to load chapter', err);
        this.error = 'Failed to load chapter content.';
        this.loading = false;
      },
    });
  }

  private loadProgressStatus(): void {
    if (!this.courseId || !this.chapterId) return;

    this.coursesService.getCourseProgress(this.courseId).subscribe({
      next: (items) => {
        const found = (Array.isArray(items) ? items : []).find(
          (i) => i && String(i.chapterId) === String(this.chapterId)
        );
        this.progressStatus = (found && found.status) || 'not_started';
      },
      error: (err) => {
        // Non-blocking: status is just for UI and avoiding downgrades.
        this.logger.error('Failed to load chapter progress status', err);
      },
    });
  }

  private updateProgressForCurrentPage(): void {
    if (this.progressUpdating) return;
    if (!this.courseId || !this.chapterId) return;
    if (!this.chapter) return;

    // Viewing a chapter should move it into in_progress, but completion is explicit.
    // Also avoid downgrading an already-completed chapter.
    const status: ChapterProgressStatus =
      this.progressStatus === 'completed' ? 'completed' : 'in_progress';

    this.progressUpdating = true;
    this.coursesService.setChapterProgress(this.courseId, this.chapterId, status).subscribe({
      next: () => {
        this.progressStatus = status;
        this.progressUpdating = false;
      },
      error: (err) => {
        // Non-blocking: progress should not prevent viewing content.
        this.logger.error('Failed to update chapter progress', err);
        this.progressUpdating = false;
      },
    });
  }

  get isLastPage(): boolean {
    return this.pageCount > 0 && this.currentPageNumber >= this.pageCount;
  }

  markComplete(): void {
    if (this.markingComplete) return;
    if (!this.courseId || !this.chapterId) return;
    if (!this.chapter) return;

    this.markingComplete = true;
    this.coursesService.setChapterProgress(this.courseId, this.chapterId, 'completed').subscribe({
      next: () => {
        this.progressStatus = 'completed';
        this.markingComplete = false;
      },
      error: (err) => {
        this.logger.error('Failed to mark chapter complete', err);
        this.markingComplete = false;
      },
    });
  }

  private getPages(): ChapterPage[] {
    const content: any = this.chapter && this.chapter.content ? this.chapter.content : {};
    const pages = Array.isArray(content.pages) ? content.pages : [];
    if (pages.length > 0) return pages;

    // Backward compatibility: treat legacy fields as single page.
    const text = typeof content.text === 'string' ? content.text : '';
    const assets = Array.isArray(content.assets) ? content.assets : [];
    return [{ text, assets }];
  }

  get pageCount(): number {
    return this.getPages().length;
  }

  get currentPageNumber(): number {
    return this.pageIndex + 1;
  }

  get currentPage(): ChapterPage {
    const pages = this.getPages();
    const idx = Math.max(0, Math.min(this.pageIndex, pages.length - 1));
    return pages[idx] || { text: '', assets: [] };
  }

  private clampPageIndex(): void {
    if (!this.chapter) return;
    const count = this.pageCount;
    if (count <= 0) {
      this.pageIndex = 0;
      return;
    }
    if (this.pageIndex < 0) this.pageIndex = 0;
    if (this.pageIndex >= count) this.pageIndex = count - 1;
  }

  get pageNumbers(): number[] {
    const count = this.pageCount;
    if (!Number.isFinite(count) || count <= 0) return [];
    return Array.from({ length: count }, (_v, i) => i + 1);
  }

  canPrev(): boolean {
    return this.pageIndex > 0;
  }

  canNext(): boolean {
    return this.pageIndex < this.pageCount - 1;
  }

  goPrev(): void {
    if (!this.canPrev()) return;
    this.setPage(this.pageIndex - 1);
  }

  goNext(): void {
    if (!this.canNext()) return;
    this.setPage(this.pageIndex + 1);
  }

  goToPage(pageNumber: number): void {
    const n = Number(pageNumber);
    if (!Number.isFinite(n)) return;
    this.setPage(n - 1);
  }

  private setPage(index: number): void {
    const count = this.pageCount;
    const clamped = Math.max(0, Math.min(index, Math.max(0, count - 1)));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: clamped + 1 },
      queryParamsHandling: 'merge',
    });
  }

  backToCourse(): void {
    this.router.navigate(['/courses', this.courseId]);
  }

  isYouTubeVideoUrl(url?: string): boolean {
    if (!url) return false;
    const lowered = String(url).toLowerCase();
    return (
      lowered.includes('youtube.com/watch') ||
      lowered.includes('youtube.com/embed/') ||
      lowered.includes('youtu.be/') ||
      lowered.includes('youtube-nocookie.com/embed/')
    );
  }

  private toYouTubeEmbedUrl(url: string): string {
    const raw = String(url || '').trim();
    if (!raw) return raw;

    // Already an embed URL
    if (raw.includes('/embed/')) return raw;

    // youtu.be/<id>
    const shortMatch = raw.match(/youtu\.be\/([\w-]{6,})/i);
    if (shortMatch && shortMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${shortMatch[1]}`;
    }

    // youtube.com/watch?v=<id>
    const vMatch = raw.match(/[?&]v=([\w-]{6,})/i);
    if (vMatch && vMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${vMatch[1]}`;
    }

    return raw;
  }

  youtubeSafeUrl(url: string): SafeResourceUrl {
    const embed = this.toYouTubeEmbedUrl(url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(embed);
  }

  trackAsset(_index: number, asset: ChapterAsset): string {
    return asset.url;
  }
}
