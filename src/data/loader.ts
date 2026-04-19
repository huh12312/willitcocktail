import { Capacitor } from '@capacitor/core';
import type { DataIndex } from './index';

// Runtime switch between web (sql.js) and native (Capacitor SQLite).
// On web, we fetch /cocktails.db and run it through sql.js in memory.
// On Android (Capacitor), we read the pre-packaged SQLite via the native plugin.
export async function loadDataIndex(): Promise<DataIndex> {
  if (Capacitor.isNativePlatform()) {
    const { loadDataIndexFromNativeSqlite } = await import('./sqlite-native');
    return loadDataIndexFromNativeSqlite();
  }
  const { loadDataIndexFromSqlite } = await import('./sqlite-web');
  return loadDataIndexFromSqlite();
}
