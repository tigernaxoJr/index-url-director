# AOFA: Decoupling Presentation and Inference for Local-First Generative Workflows via Agent-Offloaded Architecture

**Target Venues**: 
- ACM CHI (Late-Breaking Work / Case Studies)
- ACM UIST (User Interface Software and Technology)
- ICSE (Software Engineering in Practice / Tool Demonstrations)
- IEEE Software / ACM Queue

---

## Abstract
Recent advances in Large Language Model (LLM) agents have enabled autonomous software engineering and multi-modal generation directly within local developer environments. Concurrently, commercial Generative AI platforms remain predominantly cloud-hosted, imposing substantial recurring inference costs ("compute tax") on providers, locking user data within centralized servers, and offering rigid, non-inspectable outputs. 

We present **AOFA (Agent-Offloaded Frontend Architecture)**, an architectural paradigm that decouples human-facing presentation from underlying AI inference and media rendering. Under AOFA, web applications are deployed as zero-backend, zero-inference "static protocol workbenches" (the *Shell*), while planning, audio synthesis, and visual rendering are offloaded to the user's own coding agent and host CLI toolchains (the *Engine*). LLM inference is performed by the user's chosen agent backend—by default a commercial cloud provider billed to the user's existing plan, or optionally self-hosted local models for fully offline operation. By utilizing modern browser capabilities (File System Access API) and strict JSON Schema contracts, AOFA establishes the local filesystem as a shared, lock-aware Single Source of Truth (SSOT). We demonstrate AOFA through an end-to-end multi-modal video production system, showing how complex multi-stage generative pipelines can operate with zero application-side infrastructure overhead, user-controlled data boundaries, and granular user agency over generated artifacts.

---

## 1. Introduction

Generative Artificial Intelligence (GenAI) interfaces currently face an architectural trilemma among **operational cost**, **privacy/data sovereignty**, and **user steering capability**:

1. **The Cloud SaaS Paradigm**: Centralized platforms host web frontends, orchestration backends, and GPU clusters. To sustain infrastructure costs, services charge steep recurring subscriptions. Proprietary code, brand assets, and user data are continuously ingested and retained by remote servers. Furthermore, users interact through opaque text boxes with limited ability to inspect or deterministically adjust intermediate generation steps.
2. **The Autonomous Local Agent Paradigm**: Terminal-based autonomous agents (e.g., Claude Code, Codex CLI, Aider, Pi) operate directly on host filesystems with native tool access (e.g., compilers, FFmpeg, headless browsers). However, command-line interfaces lack rich visual affordances (timelines, storyboards, audio waveforms) essential for multi-modal creative tasks.
3. **The Local-First Web Challenge**: Web-based Local-First applications traditionally rely on in-browser WebAssembly (WASM) or WebGPU. However, running multi-billion-parameter foundation models and intensive multi-media rendering pipelines within browser sandboxes exhausts client memory and battery, while lacking access to mature native system utilities.

To bridge this gap, we introduce **AOFA (Agent-Offloaded Frontend Architecture)**. Inspired by the metaphor of a *powered exoskeleton* (an articulated shell driven by an internal engine), AOFA splits generative systems into:
- A **Zero-Inference Presentation Layer** delivered as a static Single-Page Application (SPA).
- A **Rigorous Protocol Contract** enforced via declarative JSON Schemas.
- An **Agentic Execution Engine** operating on the user's host machine, backed by an inference provider of the user's choosing.

```
┌────────────────────────────────────────────────────────┐
│             Presentation Layer (Static Web)            │
│  - Zero backend / Zero inference                       │
│  - Protocol visualizer & direct artifact editor        │
└───────────────────────────┬────────────────────────────┘
                            │ File System Access API
                            │ (Local Directory Handle)
┌───────────────────────────┼────────────────────────────┐
│             Filesystem as Message Bus (SSOT)           │
│  - JSON Schemas, state files, intermediate media       │
│  - Advisory lock files & metadata fingerprinting       │
└───────────────────────────▲────────────────────────────┘
                            │ Native File I/O
┌───────────────────────────┴────────────────────────────┐
│             Execution Layer (Host Environment)         │
│  - Coding Agent (e.g., Claude Code, CLI Agents)        │
│  - Native Toolchains (FFmpeg, Playwright, TTS)         │
└───────────────────────────┬────────────────────────────┘
                            │ LLM inference
                            ▼
      Cloud LLM provider (default) / Local model (optional)
Figure 1: High-level topology of Agent-Offloaded Frontend Architecture (AOFA).
```

---

## 2. Architecture & Design Principles

AOFA is governed by four core design principles:

### 2.1 Compute-Asymmetric Decoupling (Control Plane vs. Compute Plane)
Under AOFA, the system strictly separates the **Interactive Control Plane** from the **Agentic Compute Plane**. The control plane—whether deployed as a serverless static web application or as a multi-tenant cloud backend—performs **zero AI inference, generative rendering, or private file processing**. Inference is delegated to the user's agent, which may call a commercial cloud LLM (the common case) or a self-hosted local model. AOFA accommodates two primary architectural topologies:

1. **Topology I: Serverless / Pure Static AOFA (Fully Decentralized)**
   The presentation layer is deployed entirely on static file hosting services (e.g., GitHub Pages, Cloudflare Pages). The web application serves as a zero-cost, stateless protocol lens directly bound to local storage via the browser's File System Access API.
2. **Topology II: Backend-Enabled / Hybrid AOFA (Enterprise & Team Collaboration)**
   For multi-tenant platforms requiring team collaboration, single sign-on (SSO), and billing, the cloud backend acts purely as a thin coordination layer (managing user seats, telemetry, and shared prompt/schema registries). Proprietary source code and compute-heavy pipelines remain anchored to the user's host machine, with inference routed to the organization's chosen provider (Bring Your Own Agent, BYOA), ensuring near-zero marginal compute costs for the application provider.

### 2.2 Schema as the Boundary Contract
Communication between the decoupled control plane and the local execution agent eschews proprietary, opaque network APIs. Instead, the interface contract is formalized as static **JSON Schemas**. The schema specifies state machines, valid transitions, and metadata invariants. Both the client-side validators and the autonomous agent are expected to conform to the schema; because LLM agents are non-deterministic, the UI validates every agent-produced artifact before consuming it.

### 2.3 Filesystem-Centric SSOT & Coordination Bus
The host filesystem serves as the Single Source of Truth (SSOT) for execution states, private codebases, and generated media artifacts. In cloud-enabled topologies, the cloud maintains an index of high-level project metadata (Metadata Plane), while concrete artifacts remain local (Data Plane):
- **Downstream Signaling (Agent -> UI)**: The agent records operational milestones into ephemeral telemetry files (e.g., `activity.json`). The web UI observes updates via lightweight file metadata fingerprinting (evaluating `lastModified` and byte-length tuples on key project manifests) without polling full asset blobs.
- **Upstream Steering (UI -> Agent)**: When a user modifies an intermediate asset (e.g., editing a voiceover transcript or reordering a timeline), the UI updates the corresponding file and transitions the entity state to `stale`. The UI outputs an idempotent, natural language directive or CLI trigger (e.g., `/sync`) for the user to hand to their agent.

### 2.4 Lock-Aware Concurrency & Data Sovereignty
To reduce race conditions between asynchronous interface writes and host agent mutations, AOFA specifies an advisory, lease-based locking convention (`.lock` files with process IDs and TTLs) combined with write-to-temp-then-rename updates. Because the File System Access API provides no cross-process locking and agent compliance cannot be guaranteed, readers additionally validate content against the schema. Regarding data sovereignty: sensitive tokens, login sessions for recorded apps, and raw assets remain on the client machine and are omitted from version control. Context the agent sends for inference is governed by the user's chosen LLM provider; users requiring strict confidentiality can substitute local models.

---

## 3. Reference Implementation: Autonomous Video Production

To validate the feasibility of AOFA, we implemented **Index URL Director (Agent Video Producer)**, a fully-featured, open-source multi-modal video creation platform.

### 3.1 System Composition
- **Frontend Workbench**: Vue 3 + Tailwind SPA. Provides project onboarding, scene board management, transcript audio preview, and interactive video playback.
- **Protocol Definition**: Specifications defining `project.schema.json`, `scene.schema.json`, and `workflow.json`.
- **Host Pipeline**:
  - LLM Orchestrator: Claude Code executing standardized agent skills (inference via Anthropic's cloud API).
  - Web Scraper / Recorder: Headless Chromium via Playwright.
  - Audio Engine: Edge-TTS (Microsoft's online speech service) and offline phoneme synthesis; swappable for fully local engines such as Piper or Kokoro.
  - Video Compositor: FFmpeg with custom libass subtitle rendering.

### 3.2 Workflow Lifecycle
1. **Bootstrap**: The user selects an empty directory in the web workbench and inputs a target product URL. The UI generates a minimal `start.json` and a natural language invocation snippet.
2. **Analysis & Scripting**: The user pastes the snippet into their terminal agent. The agent reads the web guidance, ingests `start.json`, activates browser automation to inspect the target product, and populates the project structure with modular scene scripts (`scene.json` and `script.md`).
3. **Reactive Observation**: The web UI automatically detects the created files via fingerprint polling and renders visual cards on the Scene Board.
4. **Steering & Re-synthesis**: The user notices an awkward sentence in Scene 3's narration, modifies the script in the web workbench, and saves. The UI marks Scene 3 as `stale`. The agent is instructed to synchronize, selectively re-generating only the affected scene's audio and video without re-rendering the untouched timeline.

---

## 4. Evaluation & Discussion

### 4.1 Cost and Infrastructure Sustainability
| Dimension | Traditional Cloud GenAI SaaS | AOFA Model |
| :--- | :--- | :--- |
| **Hosting Cost** | High (GPU instances, ingress/egress, DBs) | Near-zero (Static edge CDN) |
| **Inference Cost** | Borne by the provider, recouped via subscriptions | Borne by the user's existing agent plan, or local hardware |
| **Scaling Limit** | Bound by GPU quotas and cloud budgets | Not bound by provider infrastructure; execution scales with users' own machines |
| **Maintenance** | 24/7 backend monitoring, SLA management | Zero backend services to maintain |

### 4.2 Privacy & Security Model
Under AOFA, proprietary source repositories, internal web credentials, and scratch videos are stored within the user's local operating system and never pass through the application provider's servers. No proprietary code is uploaded to a shared multi-tenant database. Authentication states (cookies/sessions required to record authenticated SaaS interfaces) are stored in local, permission-restricted directories ignored by version control. The remaining trust boundary is the user's inference provider: context the agent sends for reasoning (and text sent to online TTS services) is subject to that provider's data policy. Deployments requiring strict confidentiality can route inference to self-hosted models, making the pipeline fully offline.

### 4.3 Limitations & Future Horizons
- **Browser API Support**: Directory access via the File System Access API (`showDirectoryPicker`) is currently available only in desktop Chromium-based browsers such as Chrome and Edge; Brave disables it by default, and Firefox and Safari do not support it. Fallback mechanisms for these and mobile environments remain an active area of exploration.
- **Cognitive Load of Hybrid Execution**: Users must coordinate between two windows (the visual browser workbench and the terminal agent). We have partially mitigated this through a local Companion WebSocket bridge (bound to `127.0.0.1`, authenticated via `Origin` checks and a pairing token), but browsers' local-network-access permission prompts add friction, so pure file-mediated zero-setup interaction remains the most robust baseline.
- **Agent Non-Determinism**: Agent outputs may violate the schema or diverge across runs, requiring validation, retries, and repair guidance in the UI.
- **Cost Shifting**: AOFA eliminates provider-side inference cost by shifting it to users, which presumes users already hold (and pay for) a capable agent setup or local hardware.

---

## 5. Conclusion

AOFA provides a blueprint for a post-SaaS landscape where user interfaces are thin, declarative protocol shells and computation is delegated to user-owned agentic environments. By reframing web browsers as lenses into local agent workflows rather than portals to remote cloud computers, developers can build scalable, privacy-respecting, and highly inspectable generative software with zero application-side infrastructure overhead, while users retain the choice of where inference happens.

---

## References (Key Directions)
1. File System Access API (WICG Draft Community Group Report) and File System Standard (WHATWG).
2. Local-First Software: You own your data, in spite of the cloud (Kleppmann et al., Onward! 2019).
3. Mixed-Initiative User Interfaces (Horvitz, CHI 1999).
4. Autonomous Coding Agents in the Terminal (Anthropic Claude Code, OpenAI Codex CLI, Pi).
