declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export interface Matchers<T> {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toHaveLength(length: number): void;
    toBeNull(): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toContain(item: unknown): void;
    toMatch(pattern: RegExp | string): void;
    toThrow(): void;
    toBeGreaterThan(value: number): void;
    toBeGreaterThanOrEqual(value: number): void;
    toBeLessThan(value: number): void;
    toBeLessThanOrEqual(value: number): void;
    not: Matchers<T>;
  }
  export function expect<T>(actual: T, message?: string): Matchers<T>;
}
