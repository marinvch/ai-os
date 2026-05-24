/**
 * Tests for sdk-server.ts — McpServer factory and tool registration.
 *
 * Coverage targets:
 *  - createSdkServer() tool + prompt registration path
 *  - wrap() error boundary (success and error paths)
 */
import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSdkServer, wrap } from '../mcp-server/sdk-server.js';

describe('createSdkServer', () => {
  it('returns an McpServer instance', () => {
    const server = createSdkServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  it('returns a new independent instance on each call', () => {
    const s1 = createSdkServer();
    const s2 = createSdkServer();
    expect(s1).not.toBe(s2);
  });

  it('creates a server without throwing', () => {
    expect(() => createSdkServer()).not.toThrow();
  });
});

describe('wrap — tool handler error boundary', () => {
  it('returns content text on successful handler execution', async () => {
    const handler = wrap('test-tool', () => 'hello world');
    const result = await handler({});
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('hello world'),
    });
    expect(result.isError).toBeUndefined();
  });

  it('sets isError:true and returns error message when handler throws an Error', async () => {
    const handler = wrap('test-tool', () => {
      throw new Error('something broke');
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'something broke' });
  });

  it('sets isError:true and stringifies non-Error throws', async () => {
    const handler = wrap('test-tool', () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'raw string thrown';
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'raw string thrown' });
  });

  it('passes args through to the handler function', async () => {
    const received: Record<string, unknown>[] = [];
    const handler = wrap('test-tool', (args) => {
      received.push(args);
      return 'ok';
    });
    await handler({ key: 'value' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ key: 'value' });
  });

  it('returns a plain string result as content text', async () => {
    const handler = wrap('test-tool', () => 'plain result');
    const result = await handler({});
    expect(typeof result.content[0]?.text).toBe('string');
    expect(result.content[0]?.text).toContain('plain result');
  });
});
