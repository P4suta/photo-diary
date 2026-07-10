/** Whether we're running inside the Tauri desktop window (false in browser dev). */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
