import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KanbanService } from './kanban.service';
import { Card, COLUMN_DEFS, ColumnDef, ColumnId } from './kanban.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  columns: ColumnDef[] = COLUMN_DEFS;
  cards: Card[] = [];
  loading = true;
  error: string | null = null;

  openColumns = new Set<ColumnId>();
  draftTitles: Record<ColumnId, string> = { todo: '', in_progress: '', done: '' };
  private submittingColumns = new Set<ColumnId>();

  @ViewChildren('draftInput') private draftInputs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(private kanban: KanbanService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    this.kanban.listCards().subscribe({
      next: (cards) => {
        this.cards = cards;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not reach the kanban API. Is the backend running on port 8000?';
        this.loading = false;
      },
    });
  }

  cardsIn(column: ColumnId): Card[] {
    return this.cards.filter((c) => c.column === column);
  }

  openAdd(column: ColumnId): void {
    this.openColumns.add(column);
  }

  cancelAdd(column: ColumnId): void {
    this.openColumns.delete(column);
    this.draftTitles[column] = '';
  }

  submitAdd(column: ColumnId): void {
    const title = this.draftTitles[column].trim();
    if (!title || this.submittingColumns.has(column)) return;
    this.submittingColumns.add(column);
    this.kanban.createCard(title, column).subscribe({
      next: (card) => {
        this.cards = [...this.cards, card];
        this.draftTitles[column] = '';
        this.submittingColumns.delete(column);
        this.focusDraftInput(column);
      },
      error: () => {
        this.submittingColumns.delete(column);
      },
    });
  }

  isAdding(column: ColumnId): boolean {
    return this.openColumns.has(column);
  }

  private focusDraftInput(column: ColumnId): void {
    const input = this.draftInputs.find((ref) => ref.nativeElement.dataset['columnId'] === column);
    input?.nativeElement.focus();
  }

  move(card: Card, direction: 1 | -1): void {
    const index = this.columns.findIndex((c) => c.id === card.column);
    const target = this.columns[index + direction];
    if (!target) return;
    this.kanban.moveCard(card.id, target.id).subscribe((updated) => {
      this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
    });
  }

  remove(card: Card): void {
    this.kanban.deleteCard(card.id).subscribe(() => {
      this.cards = this.cards.filter((c) => c.id !== card.id);
    });
  }

  toggleUrgent(card: Card): void {
    this.kanban.setUrgent(card.id, !card.urgent).subscribe((updated) => {
      this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
    });
  }

  isFirst(column: ColumnId): boolean {
    return this.columns[0].id === column;
  }

  isLast(column: ColumnId): boolean {
    return this.columns[this.columns.length - 1].id === column;
  }
}
