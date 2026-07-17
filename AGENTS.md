# Repository Guidelines

## Project Structure & Module Organization

This is a Vue 3 + TypeScript + Vite fitness-recording app. Application code lives in `src/`.

- `src/main.ts` boots Vue, Pinia, Vue Router, Vant, and global CSS.
- `src/App.vue` contains the app shell.
- `src/views/` holds route pages such as `Home.vue`, `History.vue`, `Calendar.vue`, `Statistics.vue`, and `Settings.vue`.
- `src/components/` contains reusable UI components such as `EquipmentDrawer.vue`, `SetPicker.vue`, and `WheelColumn.vue`.
- `src/stores/` contains Pinia stores for exercise and workout record state.
- `src/db/database.ts` contains Dexie/IndexedDB setup.
- `src/types/` contains shared TypeScript types.
- `src/assets/` and `public/` contain static assets. `dist/` is generated build output.

## Build, Test, and Development Commands

- `npm install` installs project dependencies from `package-lock.json`.
- `npm run dev` starts the Vite development server.
- `npm run build` runs `vue-tsc -b` type checking, then creates a production build with Vite.
- `npm run preview` serves the production build locally for verification.

There is no configured `npm test` or lint script. Run `npm run build` before handing off changes; it is the main automated validation step.

## Coding Style & Naming Conventions

Use Vue single-file components with `<script setup lang="ts">`. Follow the existing style: two-space indentation, single quotes in TypeScript, no semicolons, and trailing commas in multi-line objects or arrays. Name Vue components in PascalCase, for example `EquipmentDrawer.vue`.

Prefer typed refs, computed values, and explicit function names for component behavior. Use the `@/` alias for `src/` imports. Keep shared interfaces in `src/types/` and persistence logic in `src/db/`.

## Testing Guidelines

No test framework is configured. For new features, verify with `npm run build` and a manual browser pass through affected routes. If tests are added later, place component or store tests near the relevant source or in a clearly named test directory, and use `*.spec.ts` naming.

## Commit & Pull Request Guidelines

Git history was not available in this checkout, so no repository-specific commit convention could be inferred. Use concise, imperative commit messages such as `Add workout history filters` or `Fix record deletion state`.

Pull requests should include a short summary, affected routes or components, validation performed, and screenshots for UI changes. Link related issues when available and call out any IndexedDB schema or data-shape changes.

## Security & Configuration Tips

Do not commit local environment files or browser database exports. Treat IndexedDB schema changes carefully: document migration behavior and test against existing local data before release.
