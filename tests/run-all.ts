process.env.NODE_ENV = 'test';

import http from 'node:http';
import { Duplex } from 'node:stream';
import { createApp } from '../server.ts';
import { runSuites } from './bun-test-shim.ts';

const { app } = createApp();

function createMockSocket() {
  const socket = new Duplex({
    read() {},
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  (socket as any).remoteAddress = '127.0.0.1';
  (socket as any).encrypted = false;
  return socket;
}

const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as any).url;

  if (urlStr.startsWith('http://localhost:3000') || urlStr.startsWith('http://127.0.0.1:3000')) {
    const parsed = new URL(urlStr);
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as any).method : 'GET')).toUpperCase();

    const headers: Record<string, string> = {};
    const inputHeaders = init?.headers || (typeof input === 'object' && 'headers' in input ? (input as any).headers : undefined);

    if (inputHeaders) {
      if (inputHeaders instanceof Headers) {
        for (const [k, v] of inputHeaders.entries()) headers[k.toLowerCase()] = v;
      } else if (Array.isArray(inputHeaders)) {
        for (const [k, v] of inputHeaders) headers[k.toLowerCase()] = v;
      } else {
        for (const [k, v] of Object.entries(inputHeaders)) headers[k.toLowerCase()] = String(v);
      }
    }

    let bodyBuffer: Buffer | null = null;
    const bodyInput = init?.body || (typeof input === 'object' && 'body' in input ? (input as any).body : undefined);

    if (bodyInput) {
      if (typeof bodyInput === 'string') {
        bodyBuffer = Buffer.from(bodyInput);
      } else if (Buffer.isBuffer(bodyInput)) {
        bodyBuffer = bodyInput;
      } else if (bodyInput instanceof Uint8Array) {
        bodyBuffer = Buffer.from(bodyInput);
      } else if (typeof FormData !== 'undefined' && bodyInput instanceof FormData) {
        // Serialize FormData using standard Request
        const dummyReq = new Request('http://localhost', { method: 'POST', body: bodyInput });
        const ab = await dummyReq.arrayBuffer();
        bodyBuffer = Buffer.from(ab);
        headers['content-type'] = dummyReq.headers.get('content-type') || 'multipart/form-data';
      }
    }

    if (bodyBuffer) {
      headers['content-length'] = String(bodyBuffer.length);
    }

    return new Promise<Response>((resolve) => {
      const socket = createMockSocket();
      const req = new http.IncomingMessage(socket as any);
      req.method = method;
      req.url = parsed.pathname + parsed.search;
      req.headers = headers;

      const res = new http.ServerResponse(req);
      res.assignSocket(socket as any);

      const chunks: Buffer[] = [];
      res.write = (chunk: any, enc?: any, cb?: any) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
        if (typeof enc === 'function') enc();
        else if (typeof cb === 'function') cb();
        return true;
      };

      res.end = ((chunk?: any, enc?: any, cb?: any) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
        if (typeof enc === 'function') enc();
        else if (typeof cb === 'function') cb();

        const body = Buffer.concat(chunks);
        const resHeaders = new Headers();
        const rawHeaders = res.getHeaders();
        for (const [k, v] of Object.entries(rawHeaders)) {
          if (Array.isArray(v)) {
            for (const item of v) resHeaders.append(k, String(item));
          } else if (v !== undefined) {
            resHeaders.set(k, String(v));
          }
        }

        const response = new Response(body, {
          status: res.statusCode,
          statusText: res.statusMessage || '',
          headers: resHeaders,
        });
        resolve(response);
        return res;
      }) as typeof res.end;

      (app as any).handle(req, res);

      if (bodyBuffer) {
        req.push(bodyBuffer);
        req.push(null);
        req.complete = true;
      } else {
        req.push(null);
        req.complete = true;
      }
    });
  }

  return originalFetch(input, init);
}) as typeof globalThis.fetch;

// Import test suites after fetch bridge is active
import './unit/domain.test.ts';
import './a11y-and-perf/audit.test.ts';
import './integration/api.security-and-functional.test.ts';

console.log('--- LittleSteps Full Test Suite (Unit, A11y, Performance, Security & Integration) ---');
runSuites()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
