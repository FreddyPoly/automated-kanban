import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KanbanService } from './kanban.service';
import { Card, COLUMN_DEFS, ColumnDef, ColumnId } from './kanban.model';

interface DropTarget {
  column: ColumnId;
  index: number;
}

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
  draggedCardId: number | null = null;
  dropTarget: DropTarget | null = null;
  private dropIndicatorMap: Map<number, 'before' | 'after'> = new Map();

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
    return this.cards.filter((c) => c.column === column).sort((a, b) => a.position - b.position);
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

  onDragStart(event: DragEvent, card: Card): void {
    this.draggedCardId = card.id;
    event.dataTransfer?.setData('text/plain', String(card.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd(): void {
    this.draggedCardId = null;
    this.dropTarget = null;
    this.dropIndicatorMap = new Map();
  }

  onDragOver(event: DragEvent, column: ColumnId): void {
    event.preventDefault();
    if (this.draggedCardId === null) return;
    const index = this.resolveDropIndex(event, column);
    this.dropTarget = { column, index };
    this.dropIndicatorMap = this.buildDropIndicatorMap(column, index);
  }

  onDrop(event: DragEvent, column: ColumnId): void {
    event.preventDefault();
    const cardId = this.draggedCardId;
    if (cardId === null) return;
    this.applyMove(cardId, column, this.resolveDropIndex(event, column));
    this.onDragEnd();
  }

  dropIndicator(column: ColumnId, card: Card): 'before' | 'after' | null {
    if (!this.dropTarget || this.dropTarget.column !== column) return null;
    return this.dropIndicatorMap.get(card.id) ?? null;
  }

  private buildDropIndicatorMap(column: ColumnId, index: number): Map<number, 'before' | 'after'> {
    const siblings = this.cardsIn(column).filter((c) => c.id !== this.draggedCardId);
    const map = new Map<number, 'before' | 'after'>();
    if (siblings.length === 0) return map;
    if (index < siblings.length) map.set(siblings[index].id, 'before');
    else map.set(siblings[siblings.length - 1].id, 'after');
    return map;
  }

  isEmptyDropTarget(column: ColumnId): boolean {
    return this.dropTarget?.column === column;
  }

  private resolveDropIndex(event: DragEvent, column: ColumnId): number {
    const container = event.currentTarget as HTMLElement;
    const siblings = Array.from(container.querySelectorAll<HTMLElement>('li.card')).filter(
      (el) => Number(el.dataset['cardId']) !== this.draggedCardId
    );
    for (let i = 0; i < siblings.length; i++) {
      const rect = siblings[i].getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) return i;
    }
    return siblings.length;
  }

  private applyMove(cardId: number, column: ColumnId, index: number): void {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.column === column && card.position === index) return;

    this.cards = this.reorderLocally(this.cards, cardId, column, index);
    this.kanban.moveCard(cardId, column, index).subscribe({
      next: (updated) => {
        this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
      },
      error: () => {
        this.refresh();
        this.error = 'Could not save the move. The board has been reloaded from the server.';
      },
    });
  }

  private reorderLocally(cards: Card[], cardId: number, column: ColumnId, index: number): Card[] {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return cards;
    const sourceColumn = card.column;

    const targetList = cards
      .filter((c) => c.column === column && c.id !== cardId)
      .sort((a, b) => a.position - b.position);
    const clampedIndex = Math.max(0, Math.min(index, targetList.length));
    targetList.splice(clampedIndex, 0, card);

    const positions = new Map<number, number>();
    targetList.forEach((c, i) => positions.set(c.id, i));

    if (sourceColumn !== column) {
      cards
        .filter((c) => c.column === sourceColumn && c.id !== cardId)
        .sort((a, b) => a.position - b.position)
        .forEach((c, i) => positions.set(c.id, i));
    }

    return cards.map((c) => {
      const position = positions.get(c.id);
      if (position === undefined) return c;
      return c.id === cardId ? { ...c, column, position } : { ...c, position };
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
}
