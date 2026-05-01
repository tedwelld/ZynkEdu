# ZynkEdu Web

This project is the Angular 20 frontend for ZynkEdu. It provides the shared shell and role-based workspaces for platform admins, school admins, accountants, teachers, and other staff users.

The app includes:

- Platform workspace navigation for cross-school administration
- School admin workspace for operational tasks
- Accountant workspace for dashboards, students, payments, invoices, and reports
- Teacher workspace for classes, attendance, and results
- Role-aware routing and guards that keep each user in the correct area

## Development Server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application reloads automatically when source files change.

## Building

To build the project, run:

```bash
npm run build
```

The production build output is written to `dist/sakai-ng`.

## Running Tests

To run the Angular test suite, use:

```bash
npm test
```

## Frontend Routes

The key workspace routes are:

- `/platform/...` for platform administration
- `/admin/...` for school administration
- `/accountant/...` for accounting workspaces
- `/teacher/...` for teacher workflows

The accounting workspace currently includes:

- `/accountant/dashboard`
- `/accountant/students`
- `/accountant/payments`
- `/accountant/invoices`
- `/accountant/reports`

## Notes

- The app uses the shared API service in `src/app/core/api`
- Role redirects and guards live in `src/app/core/auth`
- Workspace navigation lives in `src/app/core/navigation`
- The shell and topbar/sidebar components adapt labels based on the active role
