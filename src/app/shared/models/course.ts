export interface Course {
  id: string;
  title: string;
  description: string;
  enrolledAt?: string | null;
  courseCompleted?: boolean;
  courseInProgress?: boolean;
}
