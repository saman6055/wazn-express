import { describe, it, expect } from 'vitest';
import { classifyPhotoUrl, localUploadFileName, prunePhotoList } from './lib/photoUrls';

/**
 * These rules decide what gets deleted, so the tests are written from the
 * deletion side: what must never be removed matters more than what should.
 */

describe('classifyPhotoUrl', () => {
  it('recognises a file in our own uploads directory', () => {
    expect(classifyPhotoUrl('/uploads/abc123.jpg')).toBe('local');
  });

  it('treats anything on another host as external', () => {
    for (const u of [
      'https://cdn.example.com/a.jpg',
      'http://example.com/a.jpg',
      '//example.com/uploads/a.jpg',
      's3://bucket/a.jpg',
    ]) {
      expect(classifyPhotoUrl(u), u).toBe('external');
    }
  });

  it('treats an embedded image as inline — there is no file to miss', () => {
    expect(classifyPhotoUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe('inline');
  });

  it('refuses to classify anything it does not recognise', () => {
    for (const u of ['', '   ', 'uploads/a.jpg', '/files/a.jpg', null, undefined, 42, {}]) {
      expect(classifyPhotoUrl(u as unknown), String(u)).toBe('unknown');
    }
  });

  it('is not fooled by a remote host whose path begins with /uploads/', () => {
    // The check is on the whole URL, not on a substring anywhere in it.
    expect(classifyPhotoUrl('https://evil.example.com/uploads/a.jpg')).toBe('external');
  });
});

describe('localUploadFileName', () => {
  it('returns the bare file name', () => {
    expect(localUploadFileName('/uploads/abc123.jpg')).toBe('abc123.jpg');
  });

  it('ignores a query string or fragment', () => {
    expect(localUploadFileName('/uploads/abc.jpg?v=2')).toBe('abc.jpg');
    expect(localUploadFileName('/uploads/abc.jpg#top')).toBe('abc.jpg');
  });

  it('decodes a percent-encoded name', () => {
    expect(localUploadFileName('/uploads/my%20photo.jpg')).toBe('my photo.jpg');
  });

  it('refuses anything that is not a plain name inside the directory', () => {
    // A stored value must never steer which path gets stat-ed and deleted from.
    for (const u of [
      '/uploads/../../etc/passwd',
      '/uploads/sub/dir.jpg',
      '/uploads/..%2f..%2fsecret.jpg',
      '/uploads/a%00.jpg',
      '/uploads/',
      '/uploads/.',
      '/uploads/..',
      '/uploads/%E0%A4%A',
    ]) {
      expect(localUploadFileName(u), u).toBeNull();
    }
  });

  it('returns null for anything that is not a local upload', () => {
    expect(localUploadFileName('https://cdn.example.com/a.jpg')).toBeNull();
    expect(localUploadFileName('data:image/png;base64,AAA')).toBeNull();
  });
});

describe('prunePhotoList', () => {
  const exists = (present: string[]) => (name: string) => present.includes(name);

  it('drops a local photo whose file is gone', () => {
    const result = prunePhotoList(['/uploads/gone.jpg', '/uploads/here.jpg'], exists(['here.jpg']));

    expect(result).toEqual({ kept: ['/uploads/here.jpg'], removed: ['/uploads/gone.jpg'] });
  });

  it('reports no change when every file is still on disk', () => {
    // null means "do not write this row" — a dry run and a real run then visit
    // exactly the same rows.
    expect(prunePhotoList(['/uploads/a.jpg'], exists(['a.jpg']))).toBeNull();
  });

  it('never removes an external URL, even when nothing exists on disk', () => {
    // A missing local file proves nothing about a file on someone else's host.
    expect(prunePhotoList(['https://cdn.example.com/a.jpg'], exists([]))).toBeNull();
  });

  it('never removes an inline image', () => {
    expect(prunePhotoList(['data:image/jpeg;base64,/9j/4AAQ'], exists([]))).toBeNull();
  });

  it('never removes a value it could not classify', () => {
    expect(prunePhotoList(['uploads/a.jpg', '/files/a.jpg', ''], exists([]))).toBeNull();
  });

  it('keeps the survivors in their original order', () => {
    const result = prunePhotoList(
      ['/uploads/a.jpg', '/uploads/dead.jpg', 'https://cdn.example.com/b.jpg', '/uploads/c.jpg'],
      exists(['a.jpg', 'c.jpg']),
    );

    expect(result?.kept).toEqual(['/uploads/a.jpg', 'https://cdn.example.com/b.jpg', '/uploads/c.jpg']);
    expect(result?.removed).toEqual(['/uploads/dead.jpg']);
  });

  it('can empty a list whose photos are all gone', () => {
    const result = prunePhotoList(['/uploads/x.jpg', '/uploads/y.jpg'], exists([]));

    expect(result).toEqual({ kept: [], removed: ['/uploads/x.jpg', '/uploads/y.jpg'] });
  });

  it('leaves a row alone when photos is not a list', () => {
    for (const v of [null, undefined, 'not-an-array', 5, {}]) {
      expect(prunePhotoList(v as unknown, exists([])), String(v)).toBeNull();
    }
  });

  it('is a no-op on a second pass', () => {
    const present = exists(['keep.jpg']);
    const first = prunePhotoList(['/uploads/keep.jpg', '/uploads/dead.jpg'], present);

    expect(prunePhotoList(first!.kept, present)).toBeNull();
  });
});
