/**
 * Tests for mcp-server/utils.ts — barrel re-exporter and top-level MCP utilities.
 *
 * Coverage targets:
 *  - getProjectRoot()
 *  - getSessionContext()
 *  - checkForUpdates()
 */
import { describe, it, expect } from 'vitest';
import { getProjectRoot, getSessionContext, checkForUpdates } from '../mcp-server/utils.js';

describe('getProjectRoot', () => {
  it('returns a non-empty string', () => {
    const root = getProjectRoot();
    expect(typeof root).toBe('string');
    expect(root.length).toBeGreaterThan(0);
  });

  it('returns a string resembling a filesystem path', () => {
    const root = getProjectRoot();
    // Should contain at least one path separator
    expect(root).toMatch(/[/\\]/);
  });
});

describe('getSessionContext', () => {
  it('returns a non-empty string', () => {
    const ctx = getSessionContext();
    expect(typeof ctx).toBe('string');
    expect(ctx.length).toBeGreaterThan(0);
  });

  it('includes session start bootstrap instructions', () => {
    const ctx = getSessionContext();
    expect(ctx).toContain('get_session_context');
  });

  it('includes get_repo_memory reference', () => {
    const ctx = getSessionContext();
    expect(ctx).toContain('get_repo_memory');
  });
});

describe('checkForUpdates', () => {
  it('returns a non-empty string', () => {
    const result = checkForUpdates();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns either up-to-date message or update-available message', () => {
    const result = checkForUpdates();
    const isUpToDate = result.includes('up-to-date') || result.includes('up to date');
    const isUpdateAvailable =
      result.includes('Update Available') || result.includes('update available');
    const isNotInstalled = result.includes('not installed') || result.includes('bootstrap');
    expect(isUpToDate || isUpdateAvailable || isNotInstalled).toBe(true);
  });
});
