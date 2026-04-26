# ZynkEdu

ZynkEdu is a multi-tenant school communication and academic management platform for schools, teachers, parents, and platform administrators.

## System Overview

- Shared-database multi-tenancy with strict `SchoolId` isolation
- Admins manage only their own school's data
- Teachers can only enter results and comments for assigned subjects and classes
- Parents sign in with phone/email plus password to view results and comments
- Notifications are queued and delivered via SMS and email adapters
- Platform admins act as superusers for the application and can access every module and school overview

## Architecture

- Clean Architecture backend
- ASP.NET Core Web API
- Entity Framework Core
- Angular frontend
- JWT authentication for admins and teachers
- Password-based authentication for parents
- SQL Server LocalDB for development
- SB Admin 2 visual system and color palette

## Repository Layout

- `ZynkEdu.Domain` - entities, enums, and shared domain contracts
- `ZynkEdu.Application` - service interfaces, contracts, and abstractions
- `ZynkEdu.Infrastructure` - persistence, auth, parent login, notifications, and business services
- `ZynkEdu.Api` - API host, controllers, and middleware
- `ZynkEdu.Web` - Angular frontend
- `tests/ZynkEdu.Tests` - automated tests

The Angular frontend now adopts the SB Admin 2 theme assets from `startbootstrap-sb-admin-2-gh-pages` for its visual system and color palette.
It also uses the ZynkEdu logo on the login page and platform admin dashboard, with school-specific branding for Marist Brothers and Fatima High.

## Frontend Structure

The Angular app uses a layout-driven, role-based experience:

- `Auth` layout for login and parent sign-in
- `Dashboard` layout for admin, teacher, and parent workspaces
- Admin routes:
  - `/admin/dashboard`
  - `/admin/schools` for platform setup
  - `/admin/students`
  - `/admin/teachers`
  - `/admin/subjects`
  - `/admin/assignments`
  - `/admin/results`
  - `/admin/notifications`
  - `/admin/reports`
- Teacher routes:
  - `/teacher/dashboard`
  - `/teacher/classes`
  - `/teacher/results`
- Parent routes:
  - `/parent/dashboard`
  - `/parent/results`
  - `/parent/notifications`

The frontend uses route guards plus JWT role decoding to keep each role in its own workspace.
School admins and teachers select their school at login so concurrent school accounts stay clearly separated.
The school selector on the login page is searchable, so staff can type to find a school quickly.

## Tech Stack

- Backend: ASP.NET Core 10, C#
- ORM: Entity Framework Core 10
- Database: SQL Server LocalDB
- Frontend: Angular 21
- Authentication: JWT and password-based parent login
- Messaging: SMS and email provider abstractions

## Database Connection

The API is configured to use this development connection string:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=ZynkEduDb;MultipleActiveResultSets=true;TrustServerCertificate=true;"
  }
}
```

## Seeded Admin Account

The application seeds a platform admin account on startup if it does not already exist.

- Username: `platformadmin`
- Password: `ChangeMe123!`
- Display name: `Platform Admin`
- Role: `PlatformAdmin`

## Demo Seed Data

On startup, the application also seeds a realistic demo dataset if the school records are missing.

- Schools:
  - `Northview Academy`
  - `Lakeside Secondary School`
- Seed coverage:
  - School admins
  - Teachers
  - Subjects
  - Student records with generated student numbers
  - Teacher assignments
  - Results
  - Notifications and recipients
- Total seeded records:
  - More than 50 meaningful data rows across the two schools

This data exists so the admin dashboard can immediately show live charts, totals, pass/fail rates, top students, bottom students, and teacher performance snapshots.

## Seeded School Logins

The seeded school accounts use a shared password for quick local testing.

- School admin credentials:
  - `north.admin` / `Welcome123!` for `Northview Academy`
  - `lakeside.admin` / `Welcome123!` for `Lakeside Secondary School`
- Teacher credentials:
  - `north.math` / `Welcome123!` for `Northview Academy`
  - `north.arts` / `Welcome123!` for `Northview Academy`
  - `lakeside.science` / `Welcome123!` for `Lakeside Secondary School`
  - `lakeside.humanities` / `Welcome123!` for `Lakeside Secondary School`

## Seeded Parent Login

One parent account is seeded for quick testing of the parent login flow.

- Parent email: `test.parent@northview.zynkedu.local`
- Parent phone: `+263770100199`
- Password: `Parent123!`
- School: `Northview Academy`

## Email Delivery

The application sends parent-facing emails through the SMTP settings in `ZynkEdu.Api/appsettings.json`.

- Host: `smtp.itanywhere.africa`
- Port: `587`
- Username: `noreply@shearwatervf.com`
- Display name: `Zynk Education`
- SSL: enabled

## How To Run

Backend:

```bash
dotnet run --project ZynkEdu.Api/ZynkEdu.Api.csproj
```

Frontend:

```bash
cd ZynkEdu.Web
npm install
npm start
```

## Core Features

- Auth:
  - Staff login for admins and teachers
- Parent phone/email plus password login
- Admin workspace:
  - Dashboard analytics and visual metrics
  - Schools, students, teachers, subjects, assignments, results, notifications, and reports
  - Platform admin school-wide overview with a multi-school line graph
  - CRUD modal flows for schools, admins, teachers, students, subjects, and assignments
  - Platform admin school-admin account management
- Teacher workspace:
  - Assigned classes
  - Strict result entry for assigned subject/class combinations only
- Parent workspace:
  - Mobile-friendly dashboard
  - Results and academic alerts
- Parent login:
  - Phone number or email plus password
  - Seeded demo parent password: `Parent123!`
- School-level user and student management
- Per-school student number generation
- Teacher assignment validation before result entry
- Parent login and result visibility
- Notification scheduling and delivery
- Admin dashboard analytics

## Notes

- Tenant isolation is enforced by `SchoolId` on all school-scoped records.
- The development database target is SQL Server LocalDB, not MySQL.
- The solution structure is ready for future modules such as attendance, report cards, fees, and mobile apps.
- This root `README.md` is the single repository README for the system.
