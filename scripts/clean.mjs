import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
rmSync('coverage', { recursive: true, force: true });
