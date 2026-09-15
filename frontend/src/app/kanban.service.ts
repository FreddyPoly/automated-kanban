import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Card, ColumnId } from './kanban.model';

// Demo project: single hardcoded API base is fine, no environments needed.
const API_BASE = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class KanbanService {
  constructor(private http: HttpClient) {}

  listCards(): Observable<Card[]> {
    return this.http.get<Card[]>(`${API_BASE}/cards`);
  }

  createCard(title: string, column: ColumnId): Observable<Card> {
    return this.http.post<Card>(`${API_BASE}/cards`, { title, column });
  }

  moveCard(id: number, column: ColumnId): Observable<Card> {
    return this.http.patch<Card>(`${API_BASE}/cards/${id}/move`, { column });
  }

  setUrgent(id: number, urgent: boolean): Observable<Card> {
    return this.http.patch<Card>(`${API_BASE}/cards/${id}/urgent`, { urgent });
  }

  deleteCard(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/cards/${id}`);
  }
}
