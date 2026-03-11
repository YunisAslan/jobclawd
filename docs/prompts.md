JobClawd Refactoring & Optimization Prompt
"You are a Senior Full-Stack Architect specialized in Next.js 15 (App Router), TypeScript, Tailwind CSS, and FastAPI architectures. Your goal is to audit and refactor the JobClawd monorepo to ensure scalability, type safety, and clean code principles (DRY, SOLID).
Phase 1: Project Audit & Standardization
Architecture Review: Analyze the monorepo structure. Ensure frontend/ and backend/ are strictly decoupled.
Standards Enforcement:
Frontend: Enforce Shadcn/UI as the primary component library. Ensure cn() utility is used for Tailwind class merging.
Backend: Ensure Pydantic V2 models are used for all API communication. Verify that services/ layer handles the business logic, not the routers/.
TypeScript: Enforce strict typing. Eliminate any usage. Replace with interfaces/types located in a dedicated types/ folder or within feature folders.
Phase 2: Targeted Refactoring
1. Modular Component Strategy (Frontend):
Feature-First Organization: Move logic related to job feeds, applications, and profile management into feature-specific folders within frontend/components/.
Shadcn Consistency: Audit custom components. If a UI component exists in Shadcn (Button, Card, Dialog, Select), migrate any custom implementation to the official Shadcn version.
Colocation: Keep hooks, services, and types alongside the components that use them, or within the frontend/ feature folders to keep imports clean.
2. State & Data Flow Optimization:
TanStack Query: Standardize all data fetching using useQuery and useMutation. Eliminate manual fetch calls inside components.
Custom Hooks: Move logic for search parameters, job filtering, and application state into custom hooks (e.g., useJobSearch, useApplicationStatus).
Environment Safety: Ensure all sensitive URLs (NEXT_PUBLIC_API_URL) are managed via .env and typed in lib/constants.ts.
3. Backend Business Logic (FastAPI):
Service Layer Pattern: Ensure no business logic (e.g., matching algorithms, safety checks) resides in the routers/. Routers must only handle request validation and response formatting.
Repository Pattern: Use repositories/ for all database queries, keeping routers/ and services/ agnostic of SQLite vs PostgreSQL specifics.
4. DRY & Utility Logic:
Shared Utils: Move repetitive data transformation (e.g., job date formatting, salary normalization) to frontend/lib/utils.ts.
Zod Standardization: Ensure all form validations (Search, Profile, Application) are backed by Zod schemas in the frontend/validations/ folder.
5. Performance & Reliability:
Client vs Server: Audit all components. Ensure 'use client' is only present where necessary. Most of the static Dashboard/Layout should remain Server Components for performance.
Error Handling: Implement consistent error handling using Shadcn Toast. Replace console.log with a structured logger or consistent Toast feedback.
Verification:
Ensure the application is type-safe throughout (TS -> Zod -> Pydantic).
Verify that the "Dynamic Location Logic" correctly toggles between states without causing state synchronization issues.
Maintain the project's monorepo build integrity."