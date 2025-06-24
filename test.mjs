import { readFile } from 'fs/promises';
import assert from 'assert/strict';

const source = await readFile(new URL('./constants.ts', import.meta.url), 'utf8');
const match = source.match(/export const APP_VERSION\s*=\s*"([^"]+)"/);
assert.ok(match, 'APP_VERSION constant not found');
console.log('APP_VERSION:', match[1]);
console.log('All tests passed');

