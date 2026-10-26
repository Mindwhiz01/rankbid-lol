import { describe, expect, it } from 'vitest';
import { httpUrlOrNull, isDownloadResponse, staticUrlProblem } from '@/lib/server/url-safety';
import { assertPublicUrl, UnsafeUrlError } from '@/lib/server/safe-fetch';
import { safeExternalUrl } from '@/lib/utils';

describe('staticUrlProblem (what can be listed)', () => {
  it('accepts an ordinary site', () => {
    expect(staticUrlProblem('https://mindwhiz.com/')).toBeNull();
  });

  it.each([
    ['javascript:alert(1)', 'Only http(s)'],
    ['ftp://example.com/file', 'Only http(s)'],
    ['http://127.0.0.1/', 'raw IP'],
    ['http://[::1]/', 'raw IP'],
    ['https://bit.ly/abc', 'not allowed'],
    ['https://sub.pornhub.com/', 'not allowed'],
    ['https://discord.com/invite/abc', 'Invite links'],
    ['https://example.com/setup.exe', 'download'],
    ['not a url', 'valid URL'],
  ])('rejects %s', (url, reason) => {
    expect(staticUrlProblem(url)).toContain(reason);
  });

  it('rejects very long URLs', () => {
    expect(staticUrlProblem(`https://example.com/${'a'.repeat(2100)}`)).toContain('too long');
  });
});

describe('href sanitizers', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', ' javascript:alert(1)'])('drop %j', raw => {
    expect(safeExternalUrl(raw)).toBeNull();
    expect(httpUrlOrNull(raw)).toBeNull();
  });

  it('keep http(s) links', () => {
    expect(safeExternalUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(httpUrlOrNull('http://example.com')).toBe('http://example.com/');
  });
});

describe('isDownloadResponse', () => {
  it('flags file downloads, not pages', () => {
    expect(isDownloadResponse(new Response('', { headers: { 'content-type': 'application/x-msdownload' } }))).toBe(true);
    expect(isDownloadResponse(new Response('', { headers: { 'content-disposition': 'attachment; filename=a.zip' } }))).toBe(true);
    expect(isDownloadResponse(new Response('', { headers: { 'content-type': 'text/html; charset=utf-8' } }))).toBe(false);
  });
});

describe('assertPublicUrl (SSRF guard)', () => {
  it.each([
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[64:ff9b::7f00:1]/',
    'http://[2002:7f00:1::]/',
    'https://8.8.8.8:8443/',
    'http://user:pass@8.8.8.8/',
    'file:///etc/passwd',
  ])('blocks %s', async url => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('allows a public address', async () => {
    await expect(assertPublicUrl('https://8.8.8.8/')).resolves.toBeInstanceOf(URL);
  });
});
