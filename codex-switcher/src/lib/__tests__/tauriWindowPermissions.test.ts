import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const capability = JSON.parse(
  readFileSync(join(process.cwd(), 'src-tauri/capabilities/default.json'), 'utf8'),
) as { permissions: string[] };

describe('Tauri window permissions', () => {
  it('allows the title-bar drag window APIs', () => {
    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        'core:window:allow-set-focus',
        'core:window:allow-start-dragging',
        'core:window:allow-toggle-maximize',
      ]),
    );
  });
});
