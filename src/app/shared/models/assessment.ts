export class Assessment {
    id: number;
    title: string;
    completedAt: Date;
    questions: Question[];
    score: number;
    totalQuestions: number;
    duration?: number; // Duration in seconds
}

export class Question {
    questionNum: number;
    questionType: QuestionType;
    question: string;
    instructions: string;
    answers: string[];
    correct: number[];
    selection: number[];
    isCorrect: boolean | null;
}

export enum QuestionType {
    TrueFalse = 'TrueFalse',
    MultipleChoice = 'MultipleChoice',
    SingleAnswer = 'SingleAnswer'
}

export const QuestionTypeLabels: Record<QuestionType, string> = {
    [QuestionType.TrueFalse]: 'True or False',
    [QuestionType.MultipleChoice]: 'Multiple Choice',
    [QuestionType.SingleAnswer]: 'Single Answer'
};
