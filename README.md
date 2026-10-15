# WorkMate AI — Enterprise Productivity & Knowledge Platform

> **"From Information to Action."**  
> WorkMate AI is an enterprise-grade, AI-powered productivity platform designed to synthesize organizational knowledge, automate workflows, and drive operational decision-making with high-velocity LLM inference powered by the **Groq API**, full document intelligence and grounded RAG citations, and a scalable document store backed by **MongoDB Atlas**.

---

## 1. Platform Architecture & Phases

### Phase 1: Operational Core & Multi-Tenant Foundation
- **Application Shell & Enterprise Design System**: Clean light-theme UI designed around professional SaaS principles (#FAFBFC, #FFFFFF, #172B4D, #4F46E5, #0D9488) with responsive sidebar navigation and mobile-friendly layouts.
- **Multi-Tenant MongoDB Atlas Foundation**: Document-based schema with high-performance collections (`Users`, `Workspaces`, `WorkspaceMemberships`, `Documents`, `DocumentChunks`, `AIConversations`, `AIMessages`, `ActivityLogs`, `Tasks`, `Workflows`).
- **Multi-Tenant Authentication & Session Management**: Secure credential registration, login, logout, bcrypt password hashing, edge-compatible signed JWT session cookies with `jose`, and server-side workspace authorization.
- **Dedicated Groq API Service Layer**: Server-side LLM connectivity via official `groq-sdk`, configurable production model (`openai/gpt-oss-120b`), timeout management, and normalized provider error handling.
- **File Storage Abstraction**: Pluggable storage layer (`LocalStorageProvider`) isolating large file binaries outside MongoDB documents.

### Phase 2: Document Intelligence & Grounded RAG
- **Universal Multi-Format Ingestion**: Validated uploads for **PDF, DOCX, TXT, and CSV** documents (up to 25MB) with automatic page extraction, layout preservation, and strict workspace isolation.
- **AI Document Onboarding Agent**: Groq-powered onboarding agent that analyzes document excerpts and user purpose to propose document classification, department ownership, chunking strategy, sensitivity labels, and compliance validation rules.
- **Human-in-the-Loop Approval Screen**: AI proposals require administrator/user review and approval before vectorization; the AI is strictly prevented from granting or escalating access permissions.
- **Grounded RAG Knowledge Chat**: Full retrieval-augmented generation engine with source citations and exact page numbers. If documents lack the answer, the engine states so explicitly rather than hallucinating facts.
- **Hybrid Vector Retrieval with Fallback**: Native MongoDB Atlas `$vectorSearch` integration when configured, with an automatic, zero-configuration workspace-scoped cosine similarity and keyword matching fallback.
- **Document Intelligence Hub**: Modern document library with status metrics (`READY`, `PENDING`, `PROCESSING`, `FAILED`), search, chunk inspection, and secure file downloads.

### Phase 3: AI Data Quality & Preparation Agent
- **Spreadsheet & Tabular Ingestion**: Support for **CSV and XLSX/XLS** files up to 25MB with automated schema inference and column data type detection (`number`, `date`, `category`, `boolean`, `string`).
- **Privacy-Safe Deterministic Profiling**: Calculates duplicate rows, column sparsity/null counts, inconsistent dates (e.g. ISO vs US vs UK), inconsistent category casing/values, numeric outliers (via IQR), and an overall Data Quality Health Score (0-100%). Privacy-safe summaries ensure raw confidential rows are never transmitted to external APIs.
- **Natural Language Cleaning Agent**: Groq-powered AI agent transforms user instructions (e.g. *"Deduplicate rows, standardize all dates to YYYY-MM-DD, and fill missing department with Unknown"*) into structured, deterministic cleaning steps with explicit impact explanations.
- **Strict Allowlist & Zero-Eval Security**: Transformations execute against a strict server-side allowlist (`remove_duplicates`, `trim_whitespace`, `standardize_text`, `standardize_dates`, `rename_column`, `drop_column`, `fill_missing`, `drop_missing_rows`, `replace_values`, `filter_rows`, `handle_outliers`). Arbitrary code execution or eval is strictly prohibited.
- **Human-in-the-Loop Approval & Modification**: Interactive review screen allows operators to approve, reject, or fine-tune individual transformation steps before execution.
- **Immutable Raw Storage & Formatted Exports**: Preserves the original uploaded dataset without modification. Generates cleaned datasets downloadable in both CSV and XLSX formats, alongside full before-and-after audit logs.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router) with React 19 & TypeScript 5
- **Styling**: Tailwind CSS v4 with curated design tokens
- **Icons**: Lucide React
- **Database / ODM**: MongoDB Atlas with Mongoose 8
- **Authentication**: Credentials authentication with `bcryptjs` and encrypted JWT tokens via `jose`
- **AI Provider**: Groq API (`groq-sdk`)
- **Validation**: Zod schema validation
- **Testing**: Node 22 native test runner with `tsx`

---

## 3. Environment Variables Configuration

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB Atlas cluster connection string | `mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB` | Database name | `workmate_ai` |
| `AUTH_SECRET` | Secret key for JWT signing (min 32 chars) | `workmate_ai_super_secret_jwt_encryption_key_32_bytes_min` |
| `AUTH_COOKIE_NAME` | Session cookie identifier | `workmate_auth_token` |
| `GROQ_API_KEY` | Your Groq Cloud API Key | `gsk_...` (from console.groq.com) |
| `GROQ_MODEL` | Groq model identifier | `openai/gpt-oss-120b` |
| `APP_URL` | Base application URL | `http://localhost:3000` |
| `STORAGE_DRIVER` | Storage provider driver | `local` |
| `STORAGE_LOCAL_DIR` | Local storage folder path | `./uploads` |

> **Security Note**: Never commit `.env` or files containing secrets. `.env*` is ignored in Git while `.env.example` remains tracked.

---

## 4. Database Setup (MongoDB Atlas)

### Option A: MongoDB Atlas (Recommended Cloud Setup)

1. Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Security > Database Access**, create a database user and password.
3. Under **Security > Network Access**, add your current IP address (or `0.0.0.0/0` for development).
4. Under **Clusters > Connect > Drivers**, copy the connection string.
5. In your `.env` file, set:
   ```env
   MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
   MONGODB_DB="workmate_ai"
   ```

### Option B: Local Docker MongoDB (Optional)

If you have Docker installed and prefer running MongoDB locally:
```bash
docker compose up -d
```
Set in `.env`:
```env
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB="workmate_ai"
```

---

## 5. Development & Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Automated Tests
```bash
npm test
```
Executes unit and integration test suites covering auth validation, session security, Groq key detection, error normalization, multi-tenant boundaries, and dashboard metrics.

### 4. Run TypeScript Check
```bash
npx tsc --noEmit
```

### 5. Run Linter
```bash
npm run lint
```

### 6. Build for Production
```bash
npm run build
npm run start
```

---

## 6. API Endpoints Reference

### Authentication
- `POST /api/auth/register` — Registers user, creates workspace, associates owner membership, sets HTTP-only session cookie.
- `POST /api/auth/login` — Verifies email and hashed password, creates signed JWT session token.
- `POST /api/auth/logout` — Clears authentication cookie.
- `GET /api/auth/me` — Returns current authenticated user and workspace session details.

### AI Knowledge (Groq Engine)
- `POST /api/ai/chat` — Authenticated chat endpoint: loads context, calls Groq API, saves conversation history to MongoDB `AIMessages` collection, and records audit logs.
- `GET /api/ai/conversations` — Retrieves conversation list for the active user within their workspace.
- `GET /api/ai/conversations/[id]` — Retrieves specific conversation history with full message thread.
- `DELETE /api/ai/conversations/[id]` — Deletes a conversation and its messages.

### Document Intelligence & RAG (Phase 2)
- `POST /api/documents/upload` — Multipart file upload (PDF, DOCX, TXT, CSV), size & MIME validation, storage isolation, initial text extraction, and Groq onboarding suggestion.
- `GET /api/documents` — Lists workspace documents with search, status filters (`READY`, `PENDING`, `PROCESSING`, `FAILED`), and metrics.
- `GET /api/documents/[id]` — Returns metadata, page counts, chunk stats, and text preview for a document.
- `DELETE /api/documents/[id]` — Deletes physical storage file, cascading deletion of all associated MongoDB `DocumentChunks` and `Document` records.
- `POST /api/documents/[id]/onboard` — Re-triggers AI Onboarding Agent analysis for customized objectives.
- `POST /api/documents/[id]/onboard/approve` — Server-validated approval of onboarding configuration, initiates page chunking and vector embedding generation, sets status to `READY`.
- `GET /api/documents/[id]/chunks` — Retrieves preview of indexed vector chunks with page numbers and token counts.
- `GET /api/documents/[id]/download` — Secure workspace-isolated document file download.
- `POST /api/ai/chat` — Unified assistant endpoint supporting both `mode: "general"` and `mode: "rag"` with citations and document filtering.

---

## 7. MongoDB Atlas Vector Search Setup (Optional)

WorkMate AI features an automatic **Hybrid Vector Search Engine**. If running locally or without an Atlas Vector Search index, it operates transparently using an in-memory workspace-scoped cosine similarity and keyword matching engine.

To enable native **MongoDB Atlas Vector Search** on your cluster:
1. In the MongoDB Atlas Console, navigate to your cluster > **Atlas Search / Vector Search**.
2. Click **Create Index** > Select **Atlas Vector Search (JSON Editor)**.
3. Select Database: `workmate_ai`, Collection: `DocumentChunks`.
4. Name the index `vector_index` (or matching `MONGODB_VECTOR_INDEX` in `.env`).
5. Use this index definition:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "workspaceId"
    },
    {
      "type": "filter",
      "path": "documentId"
    }
  ]
}
```

---

## 8. Scope Boundaries & Roadmap

- **Phase 1 (Completed ✅)**: Core architecture, authentication, MongoDB Atlas models, Groq API service, AI Knowledge chat, Overview dashboard, Settings diagnostics, and responsive application shell.
- **Phase 2 (Completed ✅)**: Document Intelligence, multi-format file ingestion (PDF, DOCX, TXT, CSV), AI Document Onboarding Agent with human-in-the-loop review, vector chunking with page preservation, and Grounded RAG Knowledge Chat with source citations.
- **Phase 3 (Upcoming)**: Unstructured Data Preparation and interactive cleaning pipelines.
- **Phase 4 (Upcoming)**: Meeting Intelligence, audio transcription, speaker diarization, and timestamped retrieval.
- **Phase 5 (Upcoming)**: Micro-App Studio (on-demand prompt-to-tool creation).
- **Phase 6 (Upcoming)**: Tasks & Approved Workflows automation.
- **Phase 7 (Upcoming)**: Productivity Analytics & quantifiable ROI reporting.
