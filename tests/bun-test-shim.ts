import assert from 'node:assert';

type TestFn = () => void | Promise<void>;

interface TestSuite {
  name: string;
  tests: Array<{ name: string; fn: TestFn }>;
  beforeAlls: TestFn[];
  afterAlls: TestFn[];
}

const suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

export function describe(name: string, fn: () => void): void {
  const suite: TestSuite = { name, tests: [], beforeAlls: [], afterAlls: [] };
  const prevSuite = currentSuite;
  currentSuite = suite;
  suites.push(suite);
  fn();
  currentSuite = prevSuite;
}

export function test(name: string, fn: TestFn): void {
  if (currentSuite) {
    currentSuite.tests.push({ name, fn });
  } else {
    const suite: TestSuite = { name: 'Root', tests: [{ name, fn }], beforeAlls: [], afterAlls: [] };
    suites.push(suite);
  }
}

export function beforeAll(fn: TestFn): void {
  if (currentSuite) currentSuite.beforeAlls.push(fn);
}

export function afterAll(fn: TestFn): void {
  if (currentSuite) currentSuite.afterAlls.push(fn);
}

export function expect<T>(actual: T, customMessage?: string) {
  const msg = (def: string) => (customMessage ? `${customMessage}: ${def}` : def);
  const matchers = (isNot: boolean) => ({
    toBe(expected: unknown) {
      if (isNot) {
        assert.notStrictEqual(actual, expected, customMessage);
      } else {
        assert.strictEqual(actual, expected, customMessage);
      }
    },
    toEqual(expected: unknown) {
      if (isNot) {
        assert.notDeepStrictEqual(actual, expected, customMessage);
      } else {
        assert.deepStrictEqual(actual, expected, customMessage);
      }
    },
    toHaveLength(expectedLen: number) {
      const len = (actual as any)?.length;
      if (isNot) {
        assert.notStrictEqual(len, expectedLen, msg(`Expected length not ${expectedLen}`));
      } else {
        assert.strictEqual(len, expectedLen, msg(`Expected length ${expectedLen}, got ${len}`));
      }
    },
    toBeNull() {
      if (isNot) {
        assert.notStrictEqual(actual, null, msg('Expected value not to be null'));
      } else {
        assert.strictEqual(actual, null, msg('Expected value to be null'));
      }
    },
    toBeDefined() {
      if (isNot) {
        assert.strictEqual(actual, undefined, msg('Expected value to be undefined'));
      } else {
        assert.notStrictEqual(actual, undefined, msg('Expected value to be defined'));
      }
    },
    toBeUndefined() {
      if (isNot) {
        assert.notStrictEqual(actual, undefined, msg('Expected value not to be undefined'));
      } else {
        assert.strictEqual(actual, undefined, msg('Expected value to be undefined'));
      }
    },
    toBeTruthy() {
      if (isNot) {
        assert.ok(!actual, msg('Expected value to be falsy'));
      } else {
        assert.ok(actual, msg('Expected value to be truthy'));
      }
    },
    toContain(item: unknown) {
      if (typeof actual === 'string') {
        const contains = actual.includes(String(item));
        if (isNot) assert.ok(!contains, msg(`Expected string not to contain "${item}"`));
        else assert.ok(contains, msg(`Expected string to contain "${item}"`));
      } else if (Array.isArray(actual)) {
        const contains = actual.some((x) => {
          try {
            assert.deepStrictEqual(x, item);
            return true;
          } catch {
            return false;
          }
        });
        if (isNot) assert.ok(!contains, msg('Expected array not to contain item'));
        else assert.ok(contains, msg('Expected array to contain item'));
      }
    },
    toMatch(pattern: RegExp | string) {
      const reg = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      const matches = reg.test(String(actual));
      if (isNot) assert.ok(!matches, msg(`Expected "${actual}" not to match ${pattern}`));
      else assert.ok(matches, msg(`Expected "${actual}" to match ${pattern}`));
    },
    toThrow() {
      assert.strictEqual(typeof actual, 'function', 'expect(fn).toThrow requires a function');
      let threw = false;
      try {
        (actual as any)();
      } catch {
        threw = true;
      }
      if (isNot) assert.ok(!threw, msg('Expected function not to throw'));
      else assert.ok(threw, msg('Expected function to throw'));
    },
    toBeGreaterThan(value: number) {
      if (isNot) assert.ok(!((actual as any) > value), msg(`Expected not ${actual} > ${value}`));
      else assert.ok((actual as any) > value, msg(`Expected ${actual} > ${value}`));
    },
    toBeGreaterThanOrEqual(value: number) {
      if (isNot) assert.ok(!((actual as any) >= value), msg(`Expected not ${actual} >= ${value}`));
      else assert.ok((actual as any) >= value, msg(`Expected ${actual} >= ${value}`));
    },
    toBeLessThan(value: number) {
      if (isNot) assert.ok(!((actual as any) < value), msg(`Expected not ${actual} < ${value}`));
      else assert.ok((actual as any) < value, msg(`Expected ${actual} < ${value}`));
    },
    toBeLessThanOrEqual(value: number) {
      if (isNot) assert.ok(!((actual as any) <= value), msg(`Expected not ${actual} <= ${value}`));
      else assert.ok((actual as any) <= value, msg(`Expected ${actual} <= ${value}`));
    },
  });

  return {
    ...matchers(false),
    not: matchers(true),
  };
}

export async function runSuites() {
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const suite of suites) {
    console.log(`\n  ${suite.name}`);
    for (const b of suite.beforeAlls) await b();

    for (const t of suite.tests) {
      try {
        await t.fn();
        console.log(`    ✓ ${t.name}`);
        passed++;
      } catch (err: any) {
        console.error(`    ✗ ${t.name}`);
        console.error(`      ${err.message}`);
        if (typeof err?.stack === 'string') {
          const frame = err.stack
            .split('\n')
            .slice(1)
            .find((line: string) => line.includes('/tests/') && !line.includes('bun-test-shim'));
          if (frame) console.error(`      ${frame.trim()}`);
        }
        failed++;
      }
    }

    for (const a of suite.afterAlls) await a();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nTests: ${passed} passed, ${failed} failed (${duration}s)`);
  if (failed > 0) process.exit(1);
}
