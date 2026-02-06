import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface State {
  code: string;
  name: string;
}

export interface Country {
  code: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class UtilService {

  constructor(private http: HttpClient) { }

  getStates(): Observable<State[]> {
    return this.http.get<State[]>('/api/utils/states');
  }

  getCountries(): Observable<Country[]> {
    return this.http.get<Country[]>('/api/utils/countries');
  }
}
