import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AdminAssessmentService } from './admin-assessment.service';

describe('AdminAssessmentService', () => {
  let service: AdminAssessmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(AdminAssessmentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
