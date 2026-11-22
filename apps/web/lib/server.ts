import 'server-only';
import { getStore, type DbShape } from '@tiresias/render-worker/store';
import { NextResponse } from 'next/server';

export const store = () => getStore();

export async function readDb(): Promise<DbShape> {
  return getStore().read();
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/** Wrap a route handler: typed errors -> JSON responses, never leak stack traces. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unexpected error';
      console.error('[api]', message);
      return fail(400, message);
    }
  };
}
