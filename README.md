# ZynkEdu

ZynkEdu is a multi-tenant school communication and academic management platform for platform administrators, school administrators, teachers, and parents.

It combines a .NET 10 ASP.NET Core API with an Angular 20 frontend and a shared-database model that isolates data by `SchoolId`.

## Overview

- Manage schools and school administrators from a platform admin workspace
- Manage students, teachers, classes, subjects, subject assignments, results, reports, attendance, and notifications
- Support parent logins for viewing results, comments, and notifications
- Enforce tenant isolation so records remain separated by school
- Validate teacher assignments against the selected class level
- Provide a shared platform subject catalog that can be imported into schools

## Current Product Areas

- Platform admin dashboard with multi-school oversight
- School admin dashboards with school-scoped operational tools
- Teacher workspace for assigned classes, attendance, and result entry
- Parent workspace for results and notifications
- Subject management with level-aware subjects for `ZGC Level`, `O'Level`, and `A'Level`
- Platform subject catalog for shared templates, imports from schools, publishing to schools, and school-to-school imports
- Teacher assignment validation that requires subject level to match class level and blocks mixed-level batch selections
- Notification workflow for SMS and email delivery abstractions

## Repository Layout

- `ZynkEdu.Domain` - entities, enums, and shared domain contracts
- `ZynkEdu.Application` - service interfaces, contracts, and abstractions
- `ZynkEdu.Infrastructure` - persistence, auth, bootstrap, notifications, and business services
- `ZynkEdu.Api` - API host, controllers, middleware, and startup bootstrap
- `ZynkEdu.Web` - Angular frontend
- `tests/ZynkEdu.Tests` - automated tests

The repository root also contains `ZynkEdu.slnx`, which is the current solution entry point.

## Architecture

- Clean Architecture backend
- ASP.NET Core Web API
- Entity Framework Core
- Angular frontend
- JWT authentication for staff users
- Password-based authentication for parents
- SQL Server LocalDB for local development
- Shared-database multi-tenancy with tenant filtering by `SchoolId`

## Roles And Access

- `PlatformAdmin` - full access across schools, manages the platform school registry, manages platform-wide subject catalog features, and can create and manage school admin accounts
- `Admin` - school-scoped administrative access that manages students, teachers, subjects, assignments, results, notifications, and reports for one school
- `Teacher` - sees assigned classes and subject work and can enter results only for assigned subject/class combinations
- `Parent` - views student results and academic notifications

## Frontend Routing

The Angular app uses layout-driven, role-based routing.

- Auth routes cover login, staff sign-in, parent login, and parent OTP verification flows
- Platform routes: `/platform/dashboard`, `/platform/schools`, `/platform/admins`, `/platform/attendance`, `/platform/students`, `/platform/teachers`, `/platform/calendar`, `/platform/subjects`, `/platform/assignments`, `/platform/results`, `/platform/notifications`, `/platform/reports`
- Admin routes: `/admin/dashboard`, `/admin/students`, `/admin/teachers`, `/admin/subjects`, `/admin/assignments`, `/admin/results`, `/admin/notifications`, `/admin/reports`
- Teacher routes: `/teacher/dashboard`, `/teacher/classes`, `/teacher/results`, `/teacher/attendance`, `/teacher/notifications`
- Parent routes: `/parent/dashboard`, `/parent/results`, `/parent/notifications`

Route guards and role decoding keep each user type in its own workspace.

## Tech Stack

- Backend: ASP.NET Core 10, C#
- ORM: Entity Framework Core 10
- Database: SQL Server LocalDB
- Frontend: Angular 20
- UI libraries: PrimeNG, PrimeIcons, Tailwind CSS utilities, Chart.js
- Authentication: JWT and password-based parent login
- Messaging: SMS and email provider abstractions

## Development Prerequisites

- .NET 10 SDK
- Node.js LTS compatible with Angular 20
- npm
- SQL Server LocalDB or another SQL Server instance

## Configuration

Backend configuration lives in `ZynkEdu.Api/appsettings.json`.

- `ConnectionStrings:DefaultConnection` - local development database connection string
- `Jwt` - token issuer, audience, signing key, and expiration values
- `ParentOtp` - OTP expiry and retry settings
- `Email` - SMTP settings for parent-facing email delivery
- `Bootstrap:PlatformAdmin` - seeded platform admin credentials

The default local development database connection string is:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=ZynkEduDb;MultipleActiveResultSets=true;TrustServerCertificate=true;"
  }
}
```

## Running The App Locally

1. Restore and build the backend.

```bash
dotnet restore ZynkEdu.slnx
dotnet build ZynkEdu.slnx
```

2. Start the API.

```bash
dotnet run --project ZynkEdu.Api/ZynkEdu.Api.csproj
```

The API runs on `http://localhost:5000` in the current launch profile.

3. Install and start the frontend.

```bash
cd ZynkEdu.Web
npm install
npm start
```

The Angular development server typically runs on `http://localhost:4200`.

4. Run tests.

```bash
dotnet test tests/ZynkEdu.Tests/ZynkEdu.Tests.csproj
```

```bash
cd ZynkEdu.Web
npm run build
```

## Updating The Database

The repository now includes a migration helper for collaborators who need to create or update their LocalDB database explicitly.

From the repository root, run:

```powershell
.\scripts\Update-Database.ps1
```

You can also run the EF Core command directly:

```bash
dotnet ef database update --project ZynkEdu.Infrastructure
```

That command uses the same `appsettings.json` connection string as the running API, so collaborators do not need a separate startup project just to apply migrations.

The API also initializes the database on startup:

- if the database does not exist, EF Core migrations create it
- if pending migrations exist, the latest migrations are applied automatically
- if LocalDB is not reachable, the API fails fast instead of starting in a broken state

## Current Seeded Data

The application no longer seeds the older demo school dataset. Startup now focuses on bootstrap only.

### What Is Seeded Now

- A platform admin account is ensured on startup when `Bootstrap:PlatformAdmin` is configured
- If the database has no school record yet, startup creates a placeholder `Platform Administration` school for the platform admin account
- The platform admin bootstrap is idempotent, so rerunning the app does not duplicate the account

### What Is No Longer Seeded Automatically

- Demo schools are not seeded
- Demo school admins are not seeded
- Demo teachers are not seeded
- Demo subjects are not seeded
- Demo students are not seeded
- Demo parents are not seeded
- Demo results are not seeded
- Demo notifications are not seeded

### Legacy Demo Data Cleanup

Existing databases created before the demo seed removal are normalized by the `RemoveDemoDataKeepPlatformAdmin` migration.

That migration keeps the platform admin account and its school record, then removes the old demo dataset so the database matches the current application behavior.

### Platform Admin Bootstrap Credentials

- Username: `platformadmin`
- Password: value from `Bootstrap:PlatformAdmin:Password` in `ZynkEdu.Api/appsettings.json`
- Display name: `Platform Admin`

The default development value in the repository is `ChangeMe123!`.

## School Data Creation

Because the old school demo dataset is no longer seeded, new school records are created through the platform and admin workflows.

Use the platform admin workspace to create schools, create school admin accounts, add teachers and students, create subjects and assignments, and publish subjects from the platform catalog into schools.

## Subject And Assignment Model

- Subjects are level-aware across the system
- Supported levels are `ZGC Level`, `O'Level`, and `A'Level`
- Subjects are stored with a `gradeLevel`
- Teacher assignment requests validate that the subject level matches the class level
- Batch assignment saves require one level context
- Platform admin subject catalog entries preserve level information during imports

## Import And Catalog Workflow

Platform admins can manage a shared subject catalog and reuse it across schools.

- Create a platform-owned subject template
- Import selected subjects from any school into the platform catalog
- Import selected subjects from one school to another school
- Publish all catalog subjects into a selected school
- Skip duplicates by subject name, code, and grade level

## Authentication Notes

- Staff users sign in with username and password
- Parents sign in with phone or email plus password
- Parent OTP flows are available for the parent login experience
- JWT tokens are used for staff sessions

## Email Delivery

The application sends parent-facing email through the SMTP settings in `ZynkEdu.Api/appsettings.json`.

If you are deploying outside local development, move SMTP credentials and JWT signing values to a secure secrets store or environment-specific configuration.

## Notes

- Tenant isolation is enforced by `SchoolId` on school-scoped records
- The development database target is SQL Server LocalDB
- The frontend uses the shared workspace shell and role-based navigation
- The login page and other branding assets are loaded from the Angular asset pipeline
- The repository is structured for future modules such as fees, report cards, and mobile apps

## Helpful Files

- [`ZynkEdu.Api/Program.cs`](ZynkEdu.Api/Program.cs)
- [`ZynkEdu.Api/appsettings.json`](ZynkEdu.Api/appsettings.json)
- [`ZynkEdu.Infrastructure/Persistence/Migrations/20260427135527_RemoveDemoDataKeepPlatformAdmin.cs`](ZynkEdu.Infrastructure/Persistence/Migrations/20260427135527_RemoveDemoDataKeepPlatformAdmin.cs)
- [`ZynkEdu.Web/src/app/pages/platform/platform.routes.ts`](ZynkEdu.Web/src/app/pages/platform/platform.routes.ts)
- [`ZynkEdu.Web/src/app/pages/admin/subjects.ts`](ZynkEdu.Web/src/app/pages/admin/subjects.ts)
- [`ZynkEdu.Web/src/app/pages/admin/assignments.ts`](ZynkEdu.Web/src/app/pages/admin/assignments.ts)
