export type ColumnId = 'todo' | 'in_progress' | 'done';

export interface Card {
  id: number;
  title: string;
  column: ColumnId;
  urgent: boolean;
  position: number;
}

export interface ColumnDef {
  id: ColumnId;
  label: string;
}

export const COLUMN_DEFS: ColumnDef[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];
