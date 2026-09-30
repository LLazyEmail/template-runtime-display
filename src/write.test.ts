import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeGeneratedFile } from 'markup-generator';
import { afterEach, describe, expect, it } from 'vitest';
import { document, footer, head, main } from './index';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('markup-generator', () => {
  it('writes a rendered letter and reads the same HTML back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'template-runtime-display-'));
    dirs.push(dir);

    const html = document({
      headHtml: head({ title: 'Hi', preview: 'peek' }),
      mainHtml: main({
        heading: 'Hi',
        bodyText: 'Body',
        ctaLabel: 'Go',
        ctaUrl: 'https://example.com',
      }),
      footerHtml: footer({ companyName: 'Acme', unsubscribeUrl: 'https://example.com/u' }),
    });

    const outPath = await writeGeneratedFile({
      content: html,
      fileName: 'letter.html',
      dir,
    });

    expect(await readFile(outPath, 'utf8')).toBe(html);
    expect(html).toContain('<title>Hi</title>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Unsubscribe');
  });
});
