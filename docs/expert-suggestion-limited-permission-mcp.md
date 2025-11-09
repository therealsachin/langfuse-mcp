Short version: run the same server in two modes and expose different tools per mode. Don’t rely on the Langfuse token for scoping; enforce semantics in your MCP server and config/CLI.

Here’s how I’d do it.

---

## 1. Core idea

You already noticed the key constraint: Langfuse API keys today are project-level and generally allow both read & write. ([Langfuse][1])
So “read-only” vs “read-write” must be enforced by your MCP server, not by the key.

With MCP, the safest + most idiomatic approach is:

* Only **expose read-only tools** when in read-only mode.
* Expose **read + write tools** when in read-write mode.
* Enforce mode again inside tool handlers as a defense in depth.

If a tool doesn’t exist in the server’s advertised tool list, the client / model cannot call it. ([Model Context Protocol][2])

---

## 2. How to expose the two modes (practical pattern)

### a) Two entrypoints (recommended)

Ship a single package with two binaries:

* `langfuse-mcp-ro` → read-only
* `langfuse-mcp` (or `langfuse-mcp-rw`) → read-write

In `package.json`:

```json
{
  "bin": {
    "langfuse-mcp": "./dist/cli-rw.js",
    "langfuse-mcp-ro": "./dist/cli-ro.js"
  }
}
```

Each just calls a shared `createServer({ mode: "ro" | "rw" })`.

This gives users a very clear install story in MCP clients (Claude Desktop, mcp.co, etc):

**Read-only config:**

```json
{
  "command": "npx",
  "args": ["-y", "langfuse-mcp-server", "ro"]
}
```

**Read-write config (explicit opt-in):**

```json
{
  "command": "npx",
  "args": ["-y", "langfuse-mcp-server", "rw"]
}
```

(Exact CLI shape is up to you; above is illustrative.)

### b) Or: single binary with a `--mode` flag

If you prefer one entrypoint:

```bash
npx langfuse-mcp-server --mode=readonly
npx langfuse-mcp-server --mode=readwrite
```

Plus support `LANGFUSE_MCP_MODE=readonly|readwrite` as an alternative for mcp.co configs that like env-based setup.

**Important:** default to **read-only**, and make read-write explicit (`--mode=rw`).

---

## 3. Enforcing it inside your MCP server

### a) Tool surface by mode

At startup:

```ts
type Mode = "readonly" | "readwrite";

function getMode(): Mode {
  const m = process.env.LANGFUSE_MCP_MODE || "readonly";
  return m === "readwrite" ? "readwrite" : "readonly";
}

const mode = getMode();

const tools: McpTool[] = [
  // always allowed: read-only tools
  listProjects,
  getTrace,
  listTraces,
  getObservation,
  // etc
];

if (mode === "readwrite") {
  tools.push(
    createScore,
    updateTraceMetadata,
    deleteTraceSafely,
    // any mutating ops
  );
}

server.setTools(tools);
```

Now, in read-only mode, write tools are literally not advertised; clients can’t call them.

### b) Defense in depth in handlers

Even for write tools, check mode at runtime:

```ts
function assertWriteEnabled(mode: Mode) {
  if (mode !== "readwrite") {
    throw new McpError({
      code: "PERMISSION_DENIED",
      message: "This Langfuse MCP server is running in read-only mode; writes are disabled.",
    });
  }
}

const createScore: McpTool = {
  name: "langfuse_create_score",
  description: "Create a score on a trace",
  inputSchema: { /* ... */ },
  async invoke(args, ctx) {
    assertWriteEnabled(ctx.mode);
    // perform write via Langfuse API
  }
};
```

This prevents accidental exposure if someone misconfigures the tool list.

---

## 4. What users actually choose

For your README / mcp.co entry, I’d document two installation options:

1. **Default (safe)** – Read-only

   * Uses your Langfuse API key.
   * Only exposes tools that **never mutate** (fetch traces, spans, scores, datasets, etc).
   * Recommended for most users.

2. **Advanced** – Read-write

   * Requires explicit `--mode=readwrite` or `langfuse-mcp` binary.
   * Exposes tools that can create/update scores, tags, metadata, etc.
   * Add a clear warning that models can modify Langfuse data.

That mirrors best practice advice for MCP-style integrations: use least privilege + explicit consent. ([Model Context Protocol][3])

---

## 5. Extra hardening (nice-to-have)

If you want to go a bit further (partly opinionated/speculative):

1. **Prefix write tools clearly**

   * e.g. `langfuse.write.create_score`, `langfuse.write.tag_trace`
   * Makes their intent obvious in MCP clients.

2. **Optional confirmation guard**

   * Env flag like `LANGFUSE_MCP_WRITE_CONFIRMATION=true` to log or require a specific argument (`confirmed: true`) for destructive ops.

3. **Separate Langfuse project for write mode (if users care)**

   * Suggest (in docs) using a different Langfuse project / key for experimentation vs prod, even though technically both keys are RW. ([Langfuse][1])

4. **Telemetry**

   * Log all write operations (tool name, trace id, etc.) so users can audit what the MCP-driven agent is doing.

---

If you’d like, I can sketch the actual TS/Node skeleton for `langfuse-mcp-server` with mode handling, tool registration, and a couple of concrete Langfuse calls wired in.

**Confidence:** High. (Based on MCP spec & patterns from existing MCP servers; exact Langfuse key scoping details are from current docs.)
**Key references (URLs in code form):**

```text
MCP server concepts: https://modelcontextprotocol.io/docs/learn/server-concepts
MCP tools spec:      https://modelcontextprotocol.io/specification/2025-06-18/server/tools
Langfuse RBAC/API:   https://langfuse.com/docs/administration/rbac
Supabase MCP guide
  (read-only pattern): https://supabase.com/docs/guides/getting-started/mcp
```

[1]: https://langfuse.com/docs/administration/rbac?utm_source=chatgpt.com "Role-Based Access Controls in Langfuse"
[2]: https://modelcontextprotocol.io/specification/2025-06-18/server/tools?utm_source=chatgpt.com "Tools"
[3]: https://modelcontextprotocol.io/docs/learn/server-concepts?utm_source=chatgpt.com "Understanding MCP servers"

