import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Course } from '@models/course';
import { ChapterDetail, CourseContentTree } from '@models/course-content';
import { ChapterProgressItem, ChapterProgressStatus } from '@models/chapter-progress';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class CoursesService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>('/api/courses').pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getCourses', error);
        return this.handleError(error);
      })
    );
  }

  getMyCourses(): Observable<Course[]> {
    return this.http.get<Course[]>('/api/my/courses').pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getMyCourses', error);
        return this.handleError(error);
      })
    );
  }

  getCourse(courseId: string): Observable<Course> {
    return this.http.get<Course>(`/api/courses/${courseId}`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getCourse', error);
        return this.handleError(error);
      })
    );
  }

  getCourseContent(courseId: string): Observable<CourseContentTree> {
    return this.http.get<CourseContentTree>(`/api/courses/${courseId}/content`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getCourseContent', error);
        return this.handleError(error);
      })
    );
  }

  getCourseProgress(courseId: string): Observable<ChapterProgressItem[]> {
    return this.http.get<ChapterProgressItem[]>(`/api/courses/${courseId}/progress`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getCourseProgress', error);
        return this.handleError(error);
      })
    );
  }

  setChapterProgress(
    courseId: string,
    chapterId: string,
    status: ChapterProgressStatus
  ): Observable<ChapterProgressItem | any> {
    return this.http
      .post<ChapterProgressItem>(`/api/courses/${courseId}/progress`, { chapterId, status })
      .pipe(
        catchError((error) => {
          this.logger.error('Error in setChapterProgress', error);
          return this.handleError(error);
        })
      );
  }

  getChapter(chapterId: string): Observable<ChapterDetail> {
    return this.http.get<ChapterDetail>(`/api/chapters/${chapterId}`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getChapter', error);
        return this.handleError(error);
      })
    );
  }

  enroll(courseId: string): Observable<any> {
    return this.http.post<any>(`/api/courses/${courseId}/enroll`, {}).pipe(
      catchError((error) => {
        this.logger.error('Error in enroll', error);
        return this.handleError(error);
      })
    );
  }

  withdraw(courseId: string): Observable<any> {
    return this.http.post<any>(`/api/courses/${courseId}/withdraw`, {}).pipe(
      catchError((error) => {
        this.logger.error('Error in withdraw', error);
        return this.handleError(error);
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    const backendError = error.error || 'Something bad happened; please try again later.';
    return throwError(backendError);
  }
}
