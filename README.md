# ZynkEdu

ZynkEdu is a multi-tenant school communication, academic management, and accounting platform for platform administrators, school administrators, accountants, teachers, and guardians.

It combines a .NET 10 ASP.NET Core API with an Angular 20 frontend and a shared-database model that isolates data by `SchoolId`.

## Overview

- Manage schools and school administrators from a platform admin workspace
- Manage students, teachers, classes, subjects, subject assignments, results, reports, attendance, accounting, library, and notifications
- Capture one or more guardians per student and use those contacts for reports and notifications
- Enforce tenant isolation so records remain separated by school
- Validate teacher assignments against the selected class level
- Provide a shared platform subject catalog that can be imported into schools
- Run school-scoped accounting workflows with student accounts, invoices, payments, ledger entries, fee structures, statements, and finance reports

## Current Product Areas

- Platform admin dashboard with multi-school oversight and platform subject catalog management
- School admin dashboards with school-scoped operational tools (students, teachers, classes, subjects, assignments, timetable, grading, progression, attendance, results, notifications, reports)
- Accounting workspace for accountant setup, fee structures, payments, invoices, statements, and finance reports (collection, aging, daily cash, revenue-by-class, defaulters)
- Teacher workspace for assigned classes, attendance, result entry, subjects, timetable, profile, and notifications
- Guardian communication through emailed reports and notifications
- Library management with book catalog, copies, loans, borrowers, and dashboard
- Subject management with level-aware subjects for `ZGC Level`, `O'Level`, and `A'Level`
- Platform subject catalog for shared templates, imports from schools, publishing to schools, and school-to-school imports
- Teacher assignment validation that requires subject level to match class level and blocks mixed-level batch selections
- Notification workflow for SMS and email delivery abstractions, including staff and guardian delivery
- Double-entry-ready accounting records with audit snapshots and school-scoped tenant filters
- Academic calendar with term management and school calendar events
- Timetable generation, publication, and dispatch per school and term
- Attendance registers with daily summaries and dispatch notifications
- Student progression (promotion/demotion/transfer) with run tracking and movement history
- Student lifecycle with subject enrollment and bulk enrollment
- Result slip generation and dispatch via email with optional financial statement attachment
- Grading scheme management with school-scoped grading bands per level
- Audit logging across all entity types for data change tracking

## Repository Layout

- `ZynkEdu.Domain` - entities, enums, and shared domain contracts (school-scoped base, 40+ entity types)
- `ZynkEdu.Application` - service interfaces (30+ interfaces), contracts/records (70+ DTOs), and abstractions
- `ZynkEdu.Infrastructure` - persistence (EF Core DbContext, migrations), auth (JWT, password hashing), bootstrap seeding, messaging (SMTP email, SMS logging), accounting services, library services, background dispatch services (notifications, attendance, timetable), and 25+ business service implementations
- `ZynkEdu.Api` - API host, 21 controllers, middleware (exception handling, CORS), OpenAPI/Swagger, startup bootstrap with retry logic
- `ZynkEdu.Web` - Angular 20 frontend with standalone components, 6 role-based workspaces, PrimeNG UI, Tailwind CSS
- `tests/ZynkEdu.Tests` - 26 automated test files covering accounting, attendance, auth, grading, library, notifications, results, school classes, student lifecycle, subjects, teacher assignments, timetable, and user management

The repository root also contains `ZynkEdu.slnx`, which is the current solution entry point.

## System Requirements

### Server / Host Machine (Minimum)

| Requirement | Specification |
|---|---|
| Operating System | Windows 10/11, Windows Server 2019+, or Linux (Ubuntu 22.04+) |
| CPU | 2 cores, 2.0 GHz or faster (x64 or ARM64) |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk | 10 GB free space for SDKs, dependencies, and data |
| Database | SQL Server 2019+ (LocalDB, Express, Standard, or Azure SQL) |
| .NET SDK | .NET 10 SDK |
| Node.js | 22.x LTS (Angular 20 compatible) |
| npm | 10.x+ |

### Development Machine

| Requirement | Specification |
|---|---|
| .NET SDK | 10.0.x (SDK 10.0.100+) |
| ASP.NET Core Runtime | 10.0.7 |
| EF Core Tools | `dotnet-ef` global tool (for migrations) |
| Node.js | 22.x LTS |
| npm | 10.x+ |
| Package Manager | npm (npm install in ZynkEdu.Web) |
| IDE | Visual Studio 2022+, JetBrains Rider, or VS Code with C# Dev Kit |
| Database | SQL Server LocalDB (included with Visual Studio) or SQL Server Express |
| Browser | Chrome 120+, Firefox 120+, Edge 120+, Safari 17+ |

### Docker / Container (Recommended for Production)

| Requirement | Specification |
|---|---|
| Container Runtime | Docker Engine 24+ |
| Base Images | `mcr.microsoft.com/dotnet/aspnet:10.0` (API), `node:22-alpine` (frontend build) |
| SQL Server Image | `mcr.microsoft.com/mssql/server:2022-latest` |

## Tech Stack

### Backend (.NET 10)

| Technology | Version | Package |
|---|---|---|
| Target Framework | net10.0 | - |
| ASP.NET Core | 10.0.7 | `Microsoft.AspNetCore.App` (framework) |
| Entity Framework Core | 10.0.7 | `Microsoft.EntityFrameworkCore` |
| EF Core SQL Server Provider | 10.0.7 | `Microsoft.EntityFrameworkCore.SqlServer` |
| EF Core Design Tools | 10.0.7 | `Microsoft.EntityFrameworkCore.Design` |
| JWT Authentication | 10.0.7 | `Microsoft.AspNetCore.Authentication.JwtBearer` |
| JWT Token Handling | 8.17.0 | `System.IdentityModel.Tokens.Jwt` |
| OpenAPI / Swagger | 10.0.7 | `Microsoft.AspNetCore.OpenApi` |
| Swagger UI | 10.1.7 | `Swashbuckle.AspNetCore` |
| Email (SMTP/MIME) | 4.16.0 | `MailKit` |

### Frontend (Angular 20)

| Technology | Version |
|---|---|
| Angular | 20.x |
| TypeScript | 5.8.3 |
| Zone.js | 0.15.1 |
| RxJS | 7.8.2 |
| PrimeNG | 20.x |
| PrimeIcons | 7.0.0 |
| PrimeUIX Themes (Aura) | 1.2.1 |
| Tailwind CSS | 4.1.11 |
| TailwindCSS PrimeUI | 0.6.1 |
| PostCSS | 8.5.6 |
| Chart.js | 4.4.2 |
| jsPDF | 4.2.1 |
| jsPDF-AutoTable | 5.0.7 |
| xlsx (SheetJS) | 0.18.5 |

### Testing

| Technology | Version | Package |
|---|---|---|
| Test Framework | 2.9.3 | xUnit |
| Mocking | 4.20.69 | Moq |
| Test Runner SDK | 17.14.1 | Microsoft.NET.Test.Sdk |
| In-Memory SQL (tests) | 10.0.7 | Microsoft.EntityFrameworkCore.Sqlite |
| Integration Testing | 10.0.7 | Microsoft.AspNetCore.Mvc.Testing |
| Code Coverage | 6.0.4 | coverlet.collector |
| Angular Testing | - | Karma 6.4.4 + Jasmine Core 5.8.0 + Jasmine HTML Reporter 2.1.0 |

### Code Quality

| Tool | Version |
|---|---|
| ESLint | 9.30.1 |
| Prettier | 3.6.2 |
| Angular ESLint Plugin | bundled |

## Architecture

- **Clean Architecture** - Domain, Application, Infrastructure, and Presentation layers with inward dependency direction
- **ASP.NET Core Web API** - RESTful controllers with attribute routing, JSON serialization with `JsonStringEnumConverter`, CORS configured for `http://localhost:4200`
- **Entity Framework Core** - Code-first with Fluent API configuration, query filters for multi-tenant isolation, SQL Server provider with retry-on-failure enabled
- **Angular 20** - Standalone component architecture, lazy-loaded route modules, layout-driven shell pattern, PrimeNG theme system (Aura preset)
- **Authentication** - JWT bearer tokens for staff users; password hashed with `IPasswordHasher<AppUser>` (ASP.NET Core Identity); role-based authorization via `[Authorize(Roles = ...)]`
- **Multi-Tenancy** - Shared-database model with `SchoolId` column on every school-scoped entity; EF Core `HasQueryFilter` automatically applies tenant filter based on `ICurrentUserContext`
- **Background Services** - `NotificationDispatchHostedService`, `AttendanceDispatchHostedService`, `TimetableDispatchHostedService` for async delivery
- **Accounting Module** - Domain-first design with `StudentAccount`, `AccountingTransaction`, `LedgerEntry`, `FeeStructure`, `Invoice`, `Payment` entities; double-entry ledger; audit snapshots; dedicated controllers (`AccountingController`, `AdminAccountingController`, `PlatformAccountingController`)
- **Library Module** - `LibraryBook`, `LibraryBookCopy`, `LibraryLoan` entities; borrower management (students and teachers); loan lifecycle (issue, return, renew); overdue tracking

## Roles And Access

- `PlatformAdmin` - full access across schools, manages the platform school registry, manages platform-wide subject catalog features, and can create and manage school admin accounts, accesses all workspaces (admin, teacher, accountant, library)
- `Admin` - school-scoped administrative access that manages students, teachers, subjects, assignments, timetable, grading, progression, results, notifications, reports, attendance, calendar, and accounting for one school
- `AccountantSuper` - full accounting control, approvals, reporting, and cross-feature finance oversight within a school or platform scope
- `AccountantSenior` - manages invoices, payments, adjustments, and finance verification work
- `AccountantJunior` - captures payments and views student balances and statements
- `Teacher` - sees assigned classes and subject work and can enter results, mark attendance, view timetable, manage profile for assigned subject/class combinations
- `LibraryAdmin` - manages library books, copies, loans, and borrower records

## Frontend Routing

The Angular app uses layout-driven, role-based routing with standalone components and lazy loading.

### Platform Admin Workspace (`/platform/*`)
- `/platform/dashboard`, `/platform/schools`, `/platform/admins`, `/platform/attendance`, `/platform/students`, `/platform/teachers`, `/platform/classes`, `/platform/calendar`, `/platform/subjects`, `/platform/assignments`, `/platform/timetable`, `/platform/grading`, `/platform/progression`, `/platform/results`, `/platform/notifications`, `/platform/reports`, `/platform/accounting`

### School Admin Workspace (`/admin/*`)
- `/admin/dashboard`, `/admin/attendance`, `/admin/students`, `/admin/teachers`, `/admin/classes`, `/admin/subjects`, `/admin/assignments`, `/admin/timetable`, `/admin/grading`, `/admin/progression`, `/admin/results`, `/admin/notifications`, `/admin/calendar`, `/admin/reports`, `/admin/accounting`

### Teacher Workspace (`/teacher/*`)
- `/teacher/dashboard`, `/teacher/attendance`, `/teacher/classes`, `/teacher/results`, `/teacher/subjects`, `/teacher/timetable`, `/teacher/profile`, `/teacher/notifications`

### Accountant Workspace (`/accountant/*`)
- `/accountant/dashboard`, `/accountant/students`, `/accountant/payments`, `/accountant/invoices`, `/accountant/reports`

### Library Workspace (`/library/*`)
- `/library/dashboard`, `/library/books`, `/library/loans`, `/library/users`

### Other Routes
- `/auth/login`, `/auth/access`, `/auth/error` (authentication)
- `/account/settings` (profile settings for authenticated users)
- Landing page, CRUD demo, documentation demo pages

Route guards (`authGuard`, `workspaceGuard`) via `canActivate` and role data matching keep each user type in its own workspace.

## Backend API Controllers

| Controller | Route Prefix | Key Endpoints |
|---|---|---|
| `AuthController` | `/api/auth` | Login, get schools |
| `PlatformController` | `/api/platform` | Platform-level operations |
| `PlatformSubjectsController` | `/api/platform/subjects` | Platform subject catalog CRUD, import/publish workflows |
| `PlatformAccountingController` | `/api/platform/accounting` | Platform-scoped accounting operations |
| `UsersController` | `/api/users` | Teacher, admin, library admin, accountant CRUD |
| `StudentsController` | `/api/students` | Student CRUD, status updates |
| `SubjectsController` | `/api/subjects` | School-scoped subject CRUD |
| `ClassesController` | `/api/classes` | School class CRUD |
| `TeacherAssignmentsController` | `/api/teacher-assignments` | Assignment CRUD, batch creation |
| `ResultsController` | `/api/results` | Result CRUD, approval workflow, slip sending |
| `AttendanceController` | `/api/attendance` | Register management, daily summaries |
| `NotificationsController` | `/api/notifications` | Send and list notifications |
| `DashboardController` | `/api/dashboard` | Role-based dashboard statistics |
| `AccountingController` | `/api/accounting` | Fee structures, invoices, payments, adjustments, refunds, approval, statements, financial reports (collection, aging, daily cash, revenue-by-class, defaulters) |
| `AdminAccountingController` | `/api/admin/accounting` | Admin-scoped accounting operations |
| `AcademicCalendarController` | `/api/calendar` | Terms and calendar events |
| `TimetablesController` | `/api/timetables` | Timetable slots, publications, dispatch |
| `GradingSchemesController` | `/api/grading` | Grading band CRUD, ensure defaults |
| `ClassesController` | `/api/classes` | Class CRUD |
| `StudentLifecycleController` | `/api/student-lifecycle` | Progression runs, movements, subject enrollment |
| `LibraryController` | `/api/library` | Books, copies, loans, borrower summaries |
| `AuditLogsController` | `/api/audit-logs` | Recent audit log retrieval |

## Database

- **Engine**: SQL Server 2019+ (LocalDB for development, full SQL Server or Azure SQL for production)
- **LocalDB Connection**: `Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=ZynkEduDb;MultipleActiveResultSets=true;TrustServerCertificate=true;`
- **EF Core Provider**: `Microsoft.EntityFrameworkCore.SqlServer` with `EnableRetryOnFailure()`
- **Migrations**: Stored in `ZynkEdu.Infrastructure/Persistence/Migrations/`
- **Multi-Tenancy**: Shared-database with `SchoolId` filter applied on all school-scoped entities via EF Core query filters (40+ entity types with tenant filter)
- **Entities**: Schools, Users (PlatformAdmin, Admin, Teacher, LibraryAdmin, Accountant), Students, Guardians, Subjects, SchoolClasses, ClassSubjects, TeacherAssignments, Results, AttendanceRegisters/Entries, Notifications/Recipients, TimetableSlots/Publications, AcademicTerms/Events, StudentAccounts, AccountingTransactions, LedgerEntries, FeeStructures, Invoices, Payments, StudentMovements, ProgressionRuns, SubjectEnrollments, GradingBands, StudentNumberCounters, AuditLogs, LibraryBooks/Copies/Loans, ParentOtpChallenges, DispatchLogs

## Development Prerequisites

### Required SDKs and Runtimes

1. **.NET 10 SDK** (10.0.100 or later)
   - Verify: `dotnet --list-sdks` (must show a 10.0.x version)
   - Download from: https://dotnet.microsoft.com/download/dotnet/10.0

2. **Node.js 22.x LTS**
   - Verify: `node --version` (must be 22.x)
   - Download from: https://nodejs.org/ (LTS version)
   - npm 10.x+ is included automatically

3. **SQL Server LocalDB**
   - Included with Visual Studio 2022+ (select "Data storage and processing" workload)
   - Standalone: https://aka.ms/sqllocaldb
   - Verify: `SqlLocalDB info` (should list instances)
   - Start: `SqlLocalDB start MSSQLLocalDB`

### Optional Tools

| Tool | Purpose | Install Command |
|---|---|---|
| `dotnet-ef` | EF Core migrations CLI | `dotnet tool install --global dotnet-ef` |
| Angular CLI | Angular scaffolding | `npm install -g @angular/cli` |

## Configuration

Backend configuration lives in `ZynkEdu.Api/appsettings.json` with environment overrides in `appsettings.Development.json`.

### Configuration Keys

| Key | Description | Default Value |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | SQL Server connection string | LocalDB to `ZynkEduDb` |
| `Jwt:Issuer` | JWT token issuer | `ZynkEdu` |
| `Jwt:Audience` | JWT token audience | `ZynkEdu` |
| `Jwt:SigningKey` | HMAC signing key (min 32 chars in production) | `development-signing-key-change-me` |
| `Jwt:ExpirationMinutes` | Staff JWT lifetime | `480` (8 hours) |
| `Jwt:ParentExpirationMinutes` | Parent portal JWT lifetime | `30` |
| `ParentOtp:ExpirationMinutes` | Parent OTP code validity | `10` |
| `ParentOtp:MaxAttempts` | Max OTP verification attempts | `5` |
| `Email:EmailHost` | SMTP host | `smtp.itanywhere.africa` |
| `Email:EmailPort` | SMTP port | `587` |
| `Email:EmailUsername` | SMTP username | `noreply@shearwatervf.com` |
| `Email:EnableSsl` | SMTP SSL flag | `true` |
| `Email:TimeoutMilliseconds` | SMTP timeout | `30000` |
| `Email:MaxRetries` | Email send retry count | `3` |
| `Bootstrap:PlatformAdmin:Username` | Seeded admin username | `platformadmin` |
| `Bootstrap:PlatformAdmin:Password` | Seeded admin password | `ChangeMe123!` |

### Development Values Warning

The default `Jwt:SigningKey` and `Email` credentials in `appsettings.json` are development-only values. For any non-local deployment:
- Move JWT signing key to a secure store (e.g., User Secrets, Azure Key Vault, environment variables)
- Replace SMTP credentials with real production email service credentials
- Change the default platform admin password

## Running The App Locally

### 1. Restore and build the backend

```bash
dotnet restore ZynkEdu.slnx
dotnet build ZynkEdu.slnx
```

### 2. Start the API

```bash
dotnet run --project ZynkEdu.Api/ZynkEdu.Api.csproj
```

The API runs on `http://localhost:5000` per the launch profile. Swagger UI is available at `http://localhost:5000/swagger` in Development mode.

### 3. Install and start the frontend

```bash
cd ZynkEdu.Web
npm install
npm start
```

The Angular development server runs on `http://localhost:4200` and proxies `/api` requests to `http://localhost:5000` via `proxy.conf.json`.

### 4. Run backend tests

```bash
dotnet test tests/ZynkEdu.Tests/ZynkEdu.Tests.csproj
```

### 5. Run frontend build/lint

```bash
cd ZynkEdu.Web
npm run build
```

## Updating The Database

Use the migration helper script (PowerShell):

```powershell
.\scripts\Update-Database.ps1
```

Or run EF Core directly:

```bash
dotnet ef database update --project ZynkEdu.Infrastructure
```

The API also initializes the database automatically on startup:
- If the database does not exist, EF Core migrations create it
- If pending migrations exist, the latest migration is applied automatically
- If LocalDB is not reachable, the API retries up to 5 times with backoff before failing fast

If startup fails with a migration or schema error after pulling changes, stop any running API process and run the database update script again. The most common cause is an out-of-date LocalDB schema or a running API instance that is still holding old assemblies open.

## Current Seeded Data

The application no longer seeds demo data. Startup now focuses on bootstrap only.

### What Is Seeded Now

- A platform admin account is ensured on startup when `Bootstrap:PlatformAdmin` is configured
- If the database has no school record yet, startup creates a placeholder `Platform Administration` school for the platform admin account
- Default grading scheme bands are seeded for the platform school
- The platform admin bootstrap is idempotent, so rerunning the app does not duplicate the account

### Platform Admin Bootstrap Credentials

- Username: `platformadmin`
- Password: value from `Bootstrap:PlatformAdmin:Password` in `ZynkEdu.Api/appsettings.json`
- Display name: `Platform Admin`

The default development value in the repository is `ChangeMe123!`.

## School Data Creation

Because demo datasets are no longer seeded, new school records are created through admin workflows.

Use the platform admin workspace to:
1. Create schools via `/platform/schools`
2. Create school admin accounts via `/platform/admins`
3. School admins then add teachers, students, subjects, classes, assignments, etc.

## Subject And Assignment Model

- Subjects are level-aware across the system
- Supported levels are `ZGC Level`, `O'Level`, and `A'Level`
- Subjects are stored with a `gradeLevel` and optional `isPractical` flag
- Teacher assignment requests validate that the subject level matches the class level
- Batch assignment saves require one level context
- Platform admin subject catalog entries preserve level information during imports
- Subjects flagged as practical are used for timetable generation

## Import And Catalog Workflow

Platform admins can manage a shared subject catalog and reuse it across schools:

- Create a platform-owned subject template
- Import selected subjects from any school into the platform catalog
- Import selected subjects from one school to another school
- Publish all catalog subjects into a selected school
- Skip duplicates by subject name, code, and grade level

## Accounting Module

The accounting subsystem provides school-scoped double-entry financial management:

### Entities
- `StudentAccount` - per-student account with currency and balance
- `AccountingTransaction` - typed entries (Invoice, Payment, Adjustment, Refund) with status workflow (Pending, Approved, Rejected)
- `LedgerEntry` - double-entry lines with debit/credit and account code
- `FeeStructure` - grade-level and term-based fee definitions
- `Invoice` - student invoices with due dates and status tracking
- `Payment` - payment records with method tracking

### Reports
- Student statement (full or term-filtered) with running balance
- Financial statement (Income Statement, Balance Sheet, Cash Flow) with period modes (date, range, month, year)
- Collection report (total billed, collected, outstanding)
- Aging report (bucketed overdue analysis)
- Daily cash report (by payment method)
- Revenue by class report
- Defaulter report (students with outstanding balances)

### Accounting Roles
| Role | Permissions |
|---|---|
| `AccountantSuper` | Full control, approvals, reporting, cross-feature oversight |
| `AccountantSenior` | Manage invoices, payments, adjustments, verification |
| `AccountantJunior` | Capture payments, view balances and statements |

## Library Module

The library subsystem manages school library operations:

### Entities
- `LibraryBook` - book metadata (title, author, ISBN, publisher, category, subject, genre, edition, shelf location, condition)
- `LibraryBookCopy` - individual copies with accession number, shelf location, condition, status
- `LibraryLoan` - loan records with borrower snapshots, due dates, return tracking, renewal support

### Features
- Book catalog with full metadata
- Copy management (add, update, delete copies per book)
- Loan lifecycle (issue, return, renew)
- Borrower support for students and teachers
- Overdue loan tracking
- Borrower summaries with active loan counts

## Attendance Module

- Daily attendance registers per class
- Per-student status tracking (Present, Absent, Late, Excused)
- Daily summary reports
- Automated attendance dispatch notifications to guardians

## Timetable Module

- Per-school, per-term timetable slots
- Day-of-week and time-slot scheduling
- Teacher, subject, class, and room assignment
- Timetable publication workflow
- Automated timetable dispatch to teachers

## Result And Grading Module

- Per-student, per-subject, per-term results with score, grade, comment
- Approval workflow (Pending -> Approved -> Locked, with Reject and Reopen)
- Grading scheme with configurable bands per level (grade, min score, max score)
- Result slip generation and email dispatch with optional financial statement PDF attachment

## Authentication Notes

- Staff users sign in with username and password
- JWT tokens are used for staff sessions (8-hour expiry default)
- Password hashing using ASP.NET Core `IPasswordHasher`
- Role-based authorization enforced at controller level
- CORS configured for Angular dev server at `http://localhost:4200`

## Email And Notification Delivery

The application sends guardian-facing emails and staff notifications through SMTP.

- Email delivery via `MailKit` (SMTP with SSL support, configurable retries and timeouts)
- SMS delivery via `LoggingSmsSender` (logging-only in development; replace with provider implementation for production)
- Background hosted services dispatch pending notifications, attendance reports, and timetables asynchronously
- Fee structure newsletters with optional PDF attachment

## Notes

- Tenant isolation is enforced by `SchoolId` on school-scoped records (40+ entity types with automatic EF Core query filters)
- The development database target is SQL Server LocalDB
- The frontend uses the shared workspace shell and role-based navigation with PrimeNG theme system
- The login page and other branding assets are loaded from the Angular asset pipeline
- The parent portal has been retired; guardians are contacted through admin workflows and notifications
- The accounting subsystem is school-scoped and uses audit snapshots for financial changes
- The repository is structured for future modules such as report cards and mobile apps
- Audit logging captures actor, action, entity type, ID, old/new values, and summary for all significant data changes

## Helpful Files

- [`ZynkEdu.Api/Program.cs`](ZynkEdu.Api/Program.cs)
- [`ZynkEdu.Api/appsettings.json`](ZynkEdu.Api/appsettings.json)
- [`ZynkEdu.Infrastructure/Persistence/ZynkEduDbContext.cs`](ZynkEdu.Infrastructure/Persistence/ZynkEduDbContext.cs)
- [`ZynkEdu.Infrastructure/ServiceCollectionExtensions.cs`](ZynkEdu.Infrastructure/ServiceCollectionExtensions.cs)
- [`ZynkEdu.Infrastructure/Persistence/Migrations/20260427135527_RemoveDemoDataKeepPlatformAdmin.cs`](ZynkEdu.Infrastructure/Persistence/Migrations/20260427135527_RemoveDemoDataKeepPlatformAdmin.cs)
- [`ZynkEdu.Web/src/app.routes.ts`](ZynkEdu.Web/src/app.routes.ts)
- [`ZynkEdu.Web/src/app/pages/platform/platform.routes.ts`](ZynkEdu.Web/src/app/pages/platform/platform.routes.ts)
- [`ZynkEdu.Web/src/app/pages/admin/admin.routes.ts`](ZynkEdu.Web/src/app/pages/admin/admin.routes.ts)
- [`ZynkEdu.Web/src/app/pages/teacher/teacher.routes.ts`](ZynkEdu.Web/src/app/pages/teacher/teacher.routes.ts)
- [`ZynkEdu.Web/src/app/pages/accountant/accountant.routes.ts`](ZynkEdu.Web/src/app/pages/accountant/accountant.routes.ts)
- [`ZynkEdu.Web/src/app/pages/library/library.routes.ts`](ZynkEdu.Web/src/app/pages/library/library.routes.ts)
- [`ZynkEdu.Web/src/app/core/navigation/workspace-navigation.ts`](ZynkEdu.Web/src/app/core/navigation/workspace-navigation.ts)
- [`ZynkEdu.Api/Controllers/AccountingController.cs`](ZynkEdu.Api/Controllers/AccountingController.cs)
- [`ZynkEdu.Application/Contracts/AccountingContracts.cs`](ZynkEdu.Application/Contracts/AccountingContracts.cs)
- [`ZynkEdu.Application/ServicesInterfaces.cs`](ZynkEdu.Application/ServicesInterfaces.cs)
