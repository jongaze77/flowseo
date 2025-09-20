// Shared import progress store
// In production, this would be replaced with a proper job queue/storage like Redis

export interface ImportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: Record<string, unknown>;
  error?: string;
}

// In-memory store for development
// In production, replace with Redis, database, or proper job queue
export const importProgressStore = new Map<string, ImportProgress>();

// Helper function to update import progress
export function updateImportProgress(
  importId: string,
  status: ImportProgress['status'],
  progress: number,
  message?: string,
  result?: Record<string, unknown>,
  error?: string
) {
  importProgressStore.set(importId, {
    status,
    progress,
    message,
    result,
    error
  });
}

// Helper function to get import progress
export function getImportProgress(importId: string): ImportProgress | undefined {
  return importProgressStore.get(importId);
}

// Helper function to clear import progress
export function clearImportProgress(importId: string): boolean {
  return importProgressStore.delete(importId);
}