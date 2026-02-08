export interface ChapterOutline {
  id: string;
  lessonId: string;
  title: string;
  sortOrder: number;
}

export interface ChapterAsset {
  url: string;
  kind: 'image' | 'video' | 'file';
  originalName?: string;
  mimetype?: string;
}

export interface ChapterContent {
  text?: string;
  assets?: ChapterAsset[];
}

export interface ChapterDetail {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  sortOrder: number;
  content: ChapterContent;
}

export interface LessonOutline {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  chapters: ChapterOutline[];
}

export interface CourseContentTree {
  course: {
    id: string;
    title: string;
    description: string;
  };
  lessons: LessonOutline[];
}
