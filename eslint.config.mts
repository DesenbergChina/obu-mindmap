/// <reference types="node" />

import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig(
  globalIgnores([
    'node_modules',
    'main.js',
    'package-lock.json',
    'versions.json',
    'esbuild.config.mjs',
    'version-bump.mjs',
    'scripts/**/*.mjs',
    'test-core.cjs',
    'test-persistence.cjs',
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mts',
            'manifest.json',
          ],
        },
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
        extraFileExtensions: ['.json'],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ['eslint.config.mts'],
    rules: {
      // This file runs in Node.js as an ESLint configuration, not in Obsidian.
      'obsidianmd/no-nodejs-modules': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'obsidianmd/ui/sentence-case': ['warn', {
        brands: ['Obu Mindmap', 'Markdown', 'PNG'],
        acronyms: ['PNG'],
        enforceCamelCaseLower: true,
      }],
    },
  },
);
