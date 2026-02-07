import { Component, OnInit } from '@angular/core';
import { AssessmentUploadService } from '@admin/services/assessment-upload.service';
import { QuestionType } from '@models/quiz';

@Component({
  selector: 'app-upload-assessment',
    templateUrl: './upload-assessment.component.html',
    styleUrls: ['./upload-assessment.component.css'],
    standalone: false
})
export class UploadAssessmentComponent implements OnInit {
  selectedFile: File | null = null;
  selectedFileName: string = '';
  fileContent: any = null;
  errorMessage: string = '';
  successMessage: string = '';
  uploading: boolean = false;
  isDragOver: boolean = false;

  constructor(private assessmentUploadService: AssessmentUploadService) { }

  ngOnInit() {
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];

    if (file) {
      this.selectedFile = file;
      this.selectedFileName = file.name;
      this.errorMessage = '';
      this.successMessage = '';

      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.txt') && !fileName.endsWith('.rtf')) {
        this.errorMessage = 'Please select a valid text (.txt) or rich text (.rtf) file.';
        this.clearFile();
        return;
      }

      // Read and parse the file
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          let content = e.target.result;

          // If RTF file, strip RTF formatting
          if (fileName.endsWith('.rtf')) {
            content = this.stripRtfFormatting(content);
          }

          const assessmentData = this.parseAssessmentContent(content);
          const validationErrors = this.validateAssessmentStructure(assessmentData);

          if (validationErrors.length > 0) {
            this.errorMessage = 'Assessment validation failed:\n' + validationErrors.join('\n');
            this.fileContent = null;
          } else {
            this.fileContent = assessmentData;
          }
        } catch (error: any) {
          this.errorMessage = error.message || 'Error parsing file. Please check the format.';
          this.fileContent = null;
        }
      };
      reader.readAsText(file);
    }
  }

  stripRtfFormatting(rtfContent: string): string {
    // Remove RTF header and control words
    let text = rtfContent;

    // Remove RTF control symbols and groups
    text = text.replace(/\{\\\*[^}]*\}/g, ''); // Remove destination control symbols
    text = text.replace(/\{\\[a-z]+[0-9-]* ?/gi, ''); // Remove control words with parameters
    text = text.replace(/\\[a-z]+[0-9-]*[ ]?/gi, ' '); // Replace control words with space
    text = text.replace(/[{}]/g, ''); // Remove braces
    text = text.replace(/\\'/g, "'"); // Handle escaped quotes
    text = text.replace(/\\\\/g, ''); // Remove escaped backslashes
    text = text.replace(/\\~/g, ' '); // Non-breaking space
    text = text.replace(/\\-/g, '-'); // Optional hyphen
    text = text.replace(/\\_/g, '-'); // Non-breaking hyphen
    text = text.replace(/\\par[\r\n]*/g, '\n'); // Paragraph breaks
    text = text.replace(/\\line[\r\n]*/g, '\n'); // Line breaks
    text = text.replace(/\\tab/g, '\t'); // Tabs

    // Remove any remaining backslashes that aren't part of valid escapes
    text = text.replace(/\\./g, ''); // Remove backslash followed by any character
    text = text.replace(/\\/g, ''); // Remove any remaining lone backslashes

    // Clean up multiple newlines and spaces
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n+/g, '\n');

    return text.trim();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.txt') && !fileName.endsWith('.rtf')) {
        this.errorMessage = 'Please drop a valid text (.txt) or rich text (.rtf) file.';
        return;
      }

      // Process the dropped file using the same logic as file input
      this.selectedFile = file;
      this.selectedFileName = file.name;
      this.errorMessage = '';
      this.successMessage = '';

      // Read and parse the file
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          let content = e.target.result;

          // If RTF file, strip RTF formatting
          if (fileName.endsWith('.rtf')) {
            content = this.stripRtfFormatting(content);
          }

          const assessmentData = this.parseAssessmentContent(content);
          const validationErrors = this.validateAssessmentStructure(assessmentData);

          if (validationErrors.length > 0) {
            this.errorMessage = 'Assessment validation failed:\n\n' + validationErrors.join('\n');
            this.fileContent = null;
          } else {
            this.fileContent = assessmentData;
          }
        } catch (error: any) {
          this.errorMessage = error.message || 'Error parsing file. Please check the format.';
          this.fileContent = null;
        }
      };
      reader.readAsText(file);
    }
  }

  parseAssessmentContent(content: string): any {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const assessment: any = { questions: [] };
    let currentQuestion: any = null;

    const pushCurrentQuestion = () => {
      if (!currentQuestion) return;
      this.setDefaultInstructions(currentQuestion);
      assessment.questions.push(currentQuestion);
      currentQuestion = null;
    };

    for (const line of lines) {
      let cleanLine = line.replace(/^["']|["']$/g, '').trim();
      const colonIndex = cleanLine.indexOf(':');
      if (colonIndex === -1) continue;

      let key = cleanLine.substring(0, colonIndex).trim();
      let value = cleanLine.substring(colonIndex + 1).trim();

      key = key.replace(/["']/g, '').replace(/\\+$/g, '').trim();
      value = value.replace(/^["']|["']$/g, '').trim();

      // Convert smart quotes to regular quotes before processing escape sequences
      value = value.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

      // Process escape sequences
      value = this.processEscapeSequences(value);

      if (key === 'title') {
        assessment.title = value;
        continue;
      }

      // Optional explicit separator
      if (key === '---' || key === '---question---') {
        pushCurrentQuestion();
        continue;
      }

      // Backwards-compatible: if questionNum exists, treat it as a question boundary
      if (key === 'questionNum') {
        pushCurrentQuestion();
        currentQuestion = { selection: [], answers: [] };
        // Preserve parsed value if present, but we'll overwrite sequentially later
        const parsedNum = parseInt(value, 10);
        if (!Number.isNaN(parsedNum)) {
          currentQuestion.questionNum = parsedNum;
        }
        continue;
      }

      // If we see a new 'question:' and we already have one, treat it as a boundary
      if (key === 'question' && currentQuestion?.question) {
        pushCurrentQuestion();
      }

      if (!currentQuestion) {
        currentQuestion = { selection: [], answers: [] };
      }

      if (key === 'questionType') {
        currentQuestion.questionType = value;
      } else if (key === 'question') {
        currentQuestion.question = value;
      } else if (key === 'instructions') {
        currentQuestion.instructions = value;
      } else if (key.startsWith('answer')) {
        const answerNum = parseInt(key.substring(6), 10);
        if (!isNaN(answerNum) && answerNum > 0) {
          while (currentQuestion.answers.length < answerNum) {
            currentQuestion.answers.push('');
          }
          currentQuestion.answers[answerNum - 1] = value;
        }
      } else if (key === 'correct') {
        currentQuestion.correct = value
          .split(',')
          .map((v: string) => parseInt(v.trim(), 10))
          .filter((n: number) => !Number.isNaN(n));
      }
    }

    pushCurrentQuestion();

    // Assign questionNum automatically in sequence (1..N)
    assessment.questions.forEach((q: any, idx: number) => {
      q.questionNum = idx + 1;
    });

    if (!assessment.title) {
      throw new Error('Assessment must have a title');
    }

    if (assessment.questions.length === 0) {
      throw new Error('Assessment must have at least one question');
    }

    return assessment;
  }

  setDefaultInstructions(question: any): void {
    if (!question.instructions) {
      if (question.questionType === QuestionType.MultipleChoice) {
        question.instructions = 'Please select all that apply:';
      } else if (question.questionType === QuestionType.SingleAnswer || question.questionType === QuestionType.TrueFalse) {
        question.instructions = 'Please select the correct answer:';
      } else {
        question.instructions = 'Please answer the question:';
      }
    }
  }

  processEscapeSequences(text: string): string {
    // Preserve literal backslashes, then unescape quotes, then restore backslashes
    return text
      .replace(/\\\\/g, '\u0000')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\u0000/g, '\\');
  }

  validateAssessmentStructure(assessment: any): string[] {
    const errors: string[] = [];

    // Validate required fields (ID will be auto-assigned on server)
    if (!assessment.title) {
      errors.push('• Assessment must have a title field');
    }

    if (!assessment.questions || !Array.isArray(assessment.questions)) {
      errors.push('• Assessment must have a questions array');
      return errors;
    }

    if (assessment.questions.length === 0) {
      errors.push('• Assessment must have at least one question');
      return errors;
    }

    assessment.questions.forEach((q: any, index: number) => {
      const questionNum = index + 1;

      if (!q.question) {
        errors.push(`• Question ${questionNum}: missing 'question' field`);
      }

      if (!q.instructions) {
        errors.push(`• Question ${questionNum}: missing 'instructions' field`);
      }

      if (!q.correct) {
        errors.push(`• Question ${questionNum}: missing 'correct' field`);
      } else if (!Array.isArray(q.correct)) {
        errors.push(`• Question ${questionNum}: 'correct' must be an array`);
      } else if (q.correct.length === 0) {
        errors.push(`• Question ${questionNum}: 'correct' array must have at least one answer`);
      }

      if (!q.answers || !Array.isArray(q.answers)) {
        errors.push(`• Question ${questionNum}: missing 'answers' array`);
      } else {
        const answerCount = q.answers.filter((a: string) => a && a.trim() !== '').length;
        if (answerCount < 2) {
          errors.push(`• Question ${questionNum}: must have at least 2 answers (found ${answerCount})`);
        }
      }
    });

    return errors;
  }

  uploadAssessment(): void {
    if (!this.fileContent) {
      this.errorMessage = 'No file selected';
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.assessmentUploadService.uploadAssessment(this.fileContent).subscribe({
      next: () => {
        this.successMessage = `Assessment "${this.fileContent.title}" uploaded successfully!`;
        this.uploading = false;

        // Clear after 3 seconds
        setTimeout(() => {
          this.clearFile();
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.errorMessage = error || 'Failed to upload assessment. Please try again.';
        this.uploading = false;
      }
    });
  }

  clearFile(): void {
    this.selectedFile = null;
    this.selectedFileName = '';
    this.fileContent = null;
    this.errorMessage = '';

    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}
