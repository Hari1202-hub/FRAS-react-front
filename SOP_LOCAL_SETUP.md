# SOP: Local Setup & Project Installation for `FRAS REACTJS (FRONT END)`

## 1. Project Overview

This project is a modern React application built with:
- **Vite** (for fast development and build)
- **TypeScript** (type safety)
- **React 18**
- **Tailwind CSS** (utility-first CSS framework)
- **shadcn/ui** (UI components)
- **Radix UI** (accessible UI primitives)
- **React Router v6** (routing)
- **React Query** (data fetching/caching)
- **ESLint** (linting)
- **Lovable Tagger** (component tagging for analytics)
- **Other libraries**: axios, recharts, date-fns, zod, etc.

## 2. Prerequisites

- **Node.js** v16 or above ([Download](https://nodejs.org/))
- **npm** (comes with Node.js) or **yarn**
- **Git** ([Download](https://git-scm.com/))

## 3. Clone the Repository

```sh
git clone <repository-url>
cd <repository-root>
cd reactjs
```

## 4. Install Dependencies

```sh
npm install
# or
yarn install
```

## 5. API URL Configuration

This project does not use a `.env` file for API URLs. Instead, API endpoints and related configuration are managed directly in `src/app.js`:

```js
// For production
export const BASEURL = 'http://3.88.178.47/api/';
export const BASEPATH = 'http://3.88.178.47/';
export const BASENAME = "/";
export const TOKEN = () => localStorage.getItem("access_token") || "";
```

- For different environments (local, staging, production), you can manually comment/uncomment the relevant lines in `src/app.js`.
- Example for local development:
  ```js
  // export const BASEURL = 'http://localhost/fras/api/';
  // export const BASEURL = 'http://127.0.0.1:8000/api/';
  ```
- Example for staging:
  ```js
  // export const BASEURL = "http://44.204.69.221/api/";
  // export const BASEPATH = "http://44.204.69.221/";
  ```

**Note:**
- This approach is simple but requires code changes for environment switching.
- For production, ensure only the production URLs are uncommented.
- If you want to use environment variables in the future, consider refactoring to use Vite's `import.meta.env` and a `.env` file.

## 6. Project Structure (Key Folders)

- `src/` — Main source code
  - `components/` — Reusable UI and logic components
  - `pages/` — Route-based pages (Dashboard, Attendance, Reports, etc.)
  - `hooks/`, `lib/`, `utils/`, `types/` — Custom hooks, libraries, utilities, and TypeScript types
- `public/` — Static assets and `index.html`
- `tailwind.config.ts`, `postcss.config.js` — Tailwind and PostCSS configuration
- `vite.config.ts` — Vite configuration (port 8080, output to `public/`)

## 7. Running the Project Locally

```sh
npm run dev
# or
yarn dev
```
- The app will be available at [http://localhost:8080/](http://localhost:8080/)

## 8. Building for Production

```sh
npm run build
# or
yarn build
```
- Output is placed in the `public/` directory.

## 9. Linting & Code Quality

```sh
npm run lint
# or
yarn lint
```

## 10. Analytics & Tagging

- **Lovable Tagger** is integrated for component-level analytics during development (see `vite.config.ts`).
- Analytics and tagging are only active in development mode.
- For more, see [Lovable documentation](https://lovable.dev/).

## 11. Key Features & Modules

- **Dashboard**: Real-time employee stats, quick actions, and sync status
- **Attendance**: Manual, bulk, and history
- **Master Data**: Employees, roles, projects, attendance types
- **Reports**: Attendance and export features
- **Authentication**: Login, password management, permission guards
- **UI/UX**: Modern, responsive, accessible (Radix UI, shadcn/ui, Tailwind)

## 12. Troubleshooting

- If you encounter issues:
  - Ensure Node.js and npm/yarn versions are correct
  - Delete `node_modules` and `package-lock.json`/`yarn.lock`, then reinstall
  - Check for missing environment variables
  - Review the terminal output for errors

## 13. Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Lovable Docs](https://docs.lovable.dev/)

---


