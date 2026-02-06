import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AdminQuizService } from './admin-quiz.service';

describe('AdminQuizService', () => {
  let service: AdminQuizService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(AdminQuizService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
