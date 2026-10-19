// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearNotesDraft, readNotesDraft, writeNotesDraft } from '../notesDraft';

describe('notesDraft storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes a draft per task id', () => {
    writeNotesDraft('v-101', 'Check audit evidence');
    writeNotesDraft('v-202', 'Different draft');

    expect(readNotesDraft('v-101')).toBe('Check audit evidence');
    expect(readNotesDraft('v-202')).toBe('Different draft');
  });

  it('clears a task draft', () => {
    writeNotesDraft('v-101', 'temporary notes');

    clearNotesDraft('v-101');

    expect(readNotesDraft('v-101')).toBe('');
  });

  it('does nothing when task id is missing', () => {
    writeNotesDraft(undefined, 'ignored');
    clearNotesDraft(undefined);

    expect(readNotesDraft(undefined)).toBe('');
    expect(window.localStorage.length).toBe(0);
  });

  it('falls back safely when storage throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => writeNotesDraft('v-101', 'notes')).not.toThrow();
    expect(() => clearNotesDraft('v-101')).not.toThrow();
    expect(readNotesDraft('v-101')).toBe('');
  });

  it('stores drafts under the disciplr: namespaced key to avoid collisions', () => {
    writeNotesDraft('v-999', 'namespaced content');

    // The raw localStorage key must carry the full disciplr: prefix so it
    // cannot collide with other apps sharing the same origin.
    const storedKey = window.localStorage.key(0);
    expect(storedKey).toBe('disciplr:validation-notes-draft:v-999');
  });
});
