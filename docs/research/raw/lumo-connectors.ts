/**
 * Lumo connector bridge — works in Tauri desktop (native IPC) and in the browser.
 *
 * Desktop: calls Rust ToolRegistry via Tauri invoke.
 * Browser: uses the Lumo gateway connector API when available, with a built-in
 *          browser.fetch fallback for same-origin / CORS-accessible URLs.
 *
 * Exposed as:
 *   window.LumoConnectors          — settings UI + general connector access
 *   window.__TAURI__.external_tools — OpenAI-format tools for LumoAPIClient (desktop)
 */
import type {
  BrowserFetchInput,
  BrowserFetchResult,
  ConnectorCatalog,
  ConnectorManifest,
  FlatApiTool,
  JsonSchemaObject,
  LumoConnectorsApi,
  NamespacedTool,
  NormalizedToolCall,
  OpenAITool,
  PdfExportOptions,
  PdfExportResult,
  SettingsTab,
  ScheduleToolContext,
  ScheduleExecutionInput,
  ToolApprovalRequestPayload,
  ToolCallOptions,
  ToolApprovalResolvedPayload,
  ToolCall,
  ToolDefinition,
  ToolPolicy,
  ToolResultMessage,
  ToolsChangedDetail,
} from '../types';
import {
  BUILTIN_CONNECTORS,
  CONNECTOR_CATEGORIES,
  getFeaturedMcpServers,
  SETTINGS_CONNECTOR_TAB_PREFIX,
  categoryOf,
} from '../shared/connector-catalog';
import { logWarn } from '../shared/logger';
import { tauriInvoke as rawInvoke } from '../shared/tauri';

/** SVG data embedded by build-webview; absent in standalone bridge harnesses. */
declare const __LUMO_CONNECTOR_ICONS__: Record<string, string>;
const connectorIcons = typeof __LUMO_CONNECTOR_ICONS__ === 'undefined' ? {} : __LUMO_CONNECTOR_ICONS__;

(function () {
  'use strict';

  const GATEWAY_API = window.LUMO_CONNECTOR_API || '/api/connectors';

  function isTauri(): boolean {
    return (
      typeof window.__TAURI_INTERNALS__ !== 'undefined' ||
      typeof window.__TAURI__ !== 'undefined'
    );
  }

  const ACCOUNT_SCOPED_COMMANDS = new Set([
    'get_tool_registry',
    'get_builtin_tools',
    'invoke_tool',
    'register_schedule_execution_context',
    'connect_connector',
    'disconnect_connector',
    'set_connector_enabled',
    'set_tool_policy',
  ]);

  function withAccount(command: string, args?: TauriInvokeArgs): TauriInvokeArgs | undefined {
    if (!ACCOUNT_SCOPED_COMMANDS.has(command)) return args;
    const userId = window.__lumoAccountIdentity?.resolve?.().userId;
    return userId ? { ...args, userId } : args;
  }

  function tauriInvoke<T = unknown>(command: string, args?: TauriInvokeArgs): Promise<T> {
    return rawInvoke<T>(command, withAccount(command, args));
  }

  async function gatewayFetch<T = unknown>(
    path: string,
    options?: RequestInit
  ): Promise<T | null> {
    const res = await fetch(`${GATEWAY_API}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options,
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Gateway error ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** Browser-only manifest when the gateway is not available yet. */
  const BROWSER_ONLY_MANIFEST: ConnectorManifest = {
    id: 'browser',
    display_name: 'Browser',
    version: '1.0.0',
    readiness: { state: 'ready' },
    status: { state: 'ready' },
    enabled: true,
    tools: [
      {
        name: 'fetch',
        description: 'Fetch a URL (subject to browser CORS restrictions).',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            format: { type: 'string', enum: ['text', 'html', 'json'], default: 'text' },
          },
          required: ['url'],
        },
      },
    ],
  };

  function isConnectorReady(manifest: ConnectorManifest): boolean {
    if (manifest.enabled === false) {
      return false;
    }
    return manifest.readiness?.state === 'ready';
  }

  function namespaceTools(manifests: ConnectorManifest[]): NamespacedTool[] {
    return manifests.flatMap((c) =>
      (c.tools || [])
        .filter((t) => t.policy !== 'disable')
        .map((t) => ({
          ...t,
          name: `${c.id}__${t.name}`,
          connector_id: c.id,
          tool_name: t.name,
        }))
    );
  }

  const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

  function normalizeParameters(schema: unknown): JsonSchemaObject {
    const base: JsonSchemaObject =
      schema && typeof schema === 'object'
        ? { ...(schema as JsonSchemaObject) }
        : { type: 'object', properties: {} };
    if (!base.type) {
      base.type = 'object';
    }
    if (!base.$schema) {
      base.$schema = JSON_SCHEMA_DRAFT;
    }
    if (!base.properties) {
      base.properties = {};
    }
    return base;
  }

  /** OpenAI Chat Completions tool shape for inference requests. */
  function toOpenAITool(tool: ToolDefinition): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: normalizeParameters(tool.input_schema),
      },
    };
  }

  function toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map(toOpenAITool);
  }

  /** @deprecated Flat Lumo shape — prefer toOpenAITool for inference requests. */
  function toFlatApiTool(tool: ToolDefinition): FlatApiTool {
    const openAi = toOpenAITool(tool);
    return {
      name: openAi.function.name,
      description: openAi.function.description,
      parameters: openAi.function.parameters,
    };
  }

  function toFlatApiTools(tools: ToolDefinition[]): FlatApiTool[] {
    return tools.map(toFlatApiTool);
  }

  /**
   * Ensure a tool entry is OpenAI `{ type, function }` shape (accepts flat or nested).
   *
   * The declared parameter is narrower than the runtime guards, which also tolerate callers passing
   * something that is neither shape and return it untouched.
   */
  function ensureOpenAIToolShape(tool: OpenAITool | FlatApiTool): OpenAITool {
    if (!tool || typeof tool !== 'object') {
      return tool as OpenAITool;
    }
    const nested = tool as OpenAITool;
    if (nested.type === 'function' && nested.function) {
      return {
        type: 'function',
        function: {
          name: nested.function.name,
          description: nested.function.description || '',
          parameters: normalizeParameters(nested.function.parameters),
        },
      };
    }
    const flat = tool as FlatApiTool;
    if (flat.name && (flat.description !== undefined || flat.parameters !== undefined)) {
      return toOpenAITool({
        name: flat.name,
        description: flat.description || '',
        input_schema: flat.parameters,
      });
    }
    return tool as OpenAITool;
  }

  function stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<head[\s\S]*?<\/head>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const MAX_TEXT_CHARS = 100_000;

  function truncateText(text: string): string {
    if (text.length <= MAX_TEXT_CHARS) return text;
    return `${text.slice(0, MAX_TEXT_CHARS)}\n\n[truncated: ${text.length} characters in page, showing first ${MAX_TEXT_CHARS}]`;
  }

  async function browserClientFetch(input: BrowserFetchInput): Promise<BrowserFetchResult> {
    const res = await fetch(input.url, { credentials: 'omit' });
    const raw = await res.text();
    const format = input.format || 'text';
    let content: unknown;
    if (format === 'html') {
      content = raw;
    } else if (format === 'json') {
      try {
        content = JSON.parse(raw);
      } catch {
        content = { raw };
      }
    } else {
      content = truncateText(stripHtml(raw));
    }
    return {
      url: input.url,
      status: res.status,
      content_type: res.headers.get('content-type') || '',
      format,
      content,
    };
  }

  /** Connectors whose tools go with every request, however many other tools are connected. */
  const ALWAYS_LOADED_CONNECTORS = new Set(['browser', 'filesystem', 'bash', 'proton_mail']);
  /**
   * Once the other connectors' tools take more than this many characters of JSON (about 1k
   * tokens, roughly what the catalog replacing them costs), they are left out of requests and
   * the model finds them with `SEARCH_TOOL`.
   */
  const DEFERRAL_THRESHOLD_CHARS = 4_000;
  /** Tool names listed in `SEARCH_TOOL`'s catalog, shared fairly between connectors. */
  const CATALOG_NAME_BUDGET_CHARS = 4_000;
  const CATALOG_SUMMARY_CHARS = 160;
  const SEARCH_TOOL = 'tool_search__search_tools';
  const CALL_TOOL = 'tool_search__call_tool';
  const DEFAULT_SEARCH_LIMIT = 5;
  const MAX_SEARCH_LIMIT = 10;

  let manifests: ConnectorManifest[] = [];
  let desktopFeatureFlags = { experimentalConnectors: false };
  let builtinTools: NamespacedTool[] = [];
  let nativeTools: NamespacedTool[] = [];
  let availableTools: NamespacedTool[] = [];
  /** Searchable whether or not they are deferred right now, so a conversation that started with
   *  search keeps working after a connector is removed and deferral switches off. */
  let deferrableTools: NamespacedTool[] = [];
  let deferredTools: NamespacedTool[] = [];
  let advertisedTools: OpenAITool[] = [];
  let initPromise: Promise<void> | null = null;

  function refreshToolLists(): void {
    nativeTools = [...namespaceTools(manifests.filter((c) => c.enabled !== false)), ...builtinTools];
    availableTools = [...namespaceTools(manifests.filter(isConnectorReady)), ...builtinTools];
    deferrableTools = availableTools.filter(
      (t) => !ALWAYS_LOADED_CONNECTORS.has(t.connector_id) && !builtinTools.includes(t)
    );
    deferredTools =
      isTauri() && JSON.stringify(toOpenAITools(deferrableTools)).length > DEFERRAL_THRESHOLD_CHARS
        ? deferrableTools
        : [];
    const loaded = availableTools.filter((t) => !deferredTools.includes(t));
    advertisedTools = [
      ...toOpenAITools(loaded),
      ...(deferredTools.length > 0 ? toolSearchTools(deferredTools) : []),
    ];
  }

  function isToolSearchTool(name: string): boolean {
    return isTauri() && (name === SEARCH_TOOL || name === CALL_TOOL);
  }

  function connectorSummary(id: string): string {
    const preset = [...BUILTIN_CONNECTORS, ...getFeaturedMcpServers(true)].find((entry) => entry.id === id);
    const summary = (manifests.find((m) => m.id === id)?.description || preset?.description || '')
      .replace(/\s+/g, ' ')
      .trim();
    return summary.length > CATALOG_SUMMARY_CHARS ? `${summary.slice(0, CATALOG_SUMMARY_CHARS - 1)}…` : summary;
  }

  type NameGroup = { prefix: string; rests: string[] };

  /** Names sharing a leading word, such as `get_` or `create` in `createIssue`, are grouped. */
  function groupByPrefix(names: string[]): NameGroup[] {
    const groups = new Map<string, string[]>();
    for (const name of names) {
      const prefix = name.match(/^[a-z0-9]+(?:[_.-]|(?=[A-Z]))/)?.[0] ?? '';
      groups.set(prefix, [...(groups.get(prefix) ?? []), name.slice(prefix.length)]);
    }
    return [...groups].flatMap(([prefix, rests]) =>
      prefix && rests.length > 1
        ? [{ prefix, rests }]
        : rests.map((rest) => ({ prefix: '', rests: [prefix + rest] }))
    );
  }

  function renderGroup({ prefix, rests }: NameGroup): string {
    return rests.length > 1 ? `${prefix}{${rests.join(',')}}` : prefix + rests[0];
  }

  /** As many of `names` as fit in `budget` characters, grouped by prefix, and how many didn't. */
  function compressNames(names: string[], budget: number): { text: string; omitted: number } {
    const parts: string[] = [];
    let used = 0;
    let shown = 0;
    for (const group of groupByPrefix(names)) {
      const fit: string[] = [];
      for (const rest of group.rests) {
        const part = renderGroup({ prefix: group.prefix, rests: [...fit, rest] });
        if (used + part.length + 2 > budget) break;
        fit.push(rest);
      }
      if (fit.length === 0) break;
      const part = renderGroup({ prefix: group.prefix, rests: fit });
      parts.push(part);
      used += part.length + 2;
      shown += fit.length;
      if (fit.length < group.rests.length) break;
    }
    return { text: parts.join(', '), omitted: names.length - shown };
  }

  /**
   * One entry per connector: its name, a one-line summary and as many tool names as its share of
   * the budget allows. Connectors needing less than an even share give the rest to the others.
   */
  function toolCatalog(deferred: NamespacedTool[]): string {
    const names = new Map<string, string[]>();
    for (const tool of deferred) {
      names.set(tool.connector_id, [...(names.get(tool.connector_id) ?? []), tool.tool_name]);
    }
    const cost = (list: string[]) => compressNames(list, Infinity).text.length + 2;
    const listed = new Map<string, { text: string; omitted: number }>();
    let remaining = CATALOG_NAME_BUDGET_CHARS;
    const bySize = [...names].sort(([, a], [, b]) => cost(a) - cost(b));
    bySize.forEach(([id, list], i) => {
      const compressed = compressNames(list, Math.floor(remaining / (bySize.length - i)));
      listed.set(id, compressed);
      remaining -= compressed.text.length + 2;
    });
    const entries = [...names].map(([id, list]) => {
      const display = manifests.find((m) => m.id === id)?.display_name || id;
      const summary = connectorSummary(id);
      const { text, omitted } = listed.get(id) ?? { text: '', omitted: list.length };
      const tools = text ? `${text}${omitted ? `, and ${omitted} more` : ''}` : `${list.length} tools`;
      return `- ${display} (connector "${id}")${summary ? `: ${summary}` : ''}\n  Tools: ${tools}`;
    });
    return [
      'Braces group names with a shared start: get_{matter,task} means get_matter and get_task.',
      ...entries,
    ].join('\n');
  }

  function toolSearchTools(deferred: NamespacedTool[]): OpenAITool[] {
    return [
      {
        type: 'function',
        function: {
          name: SEARCH_TOOL,
          description:
            'Get the parameters of tools from the user\'s connected services, which are listed ' +
            'below by name only to save space. Pass the names you need; search with a query only ' +
            'for tools the list leaves out. Run a tool with ' +
            `${CALL_TOOL}. Check here before saying a service can't do something.\n` +
            toolCatalog(deferred),
          parameters: normalizeParameters({
            type: 'object',
            properties: {
              names: {
                type: 'array',
                items: { type: 'string' },
                maxItems: MAX_SEARCH_LIMIT,
                description: 'Exact tool names from the list, e.g. ["list_matters", "get_matter"].',
              },
              query: {
                type: 'string',
                description: 'Words describing the task, e.g. "create issue" or "list matters".',
              },
              connector: {
                type: 'string',
                description: 'Only search this connector. With an empty query, lists its tools.',
              },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: MAX_SEARCH_LIMIT,
                description: `How many tools to return (default ${DEFAULT_SEARCH_LIMIT}).`,
              },
            },
          }),
        },
      },
      {
        type: 'function',
        function: {
          name: CALL_TOOL,
          description: `Run a tool whose parameters you got from ${SEARCH_TOOL}.`,
          parameters: normalizeParameters({
            type: 'object',
            properties: {
              name: { type: 'string', description: `The tool's full name as ${SEARCH_TOOL} returned it.` },
              arguments: { type: 'object', description: 'Arguments matching the tool\'s parameters.' },
            },
            required: ['name', 'arguments'],
          }),
        },
      },
    ];
  }

  function searchTerms(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  /** Name matches count most, then the connector, then the title and description. */
  function searchScore(tool: NamespacedTool, terms: string[]): number {
    const nameTerms = searchTerms(tool.tool_name);
    const connector = `${tool.connector_id} ${manifests.find((m) => m.id === tool.connector_id)?.display_name ?? ''}`.toLowerCase();
    const text = `${tool.title ?? ''} ${tool.description ?? ''}`.toLowerCase();
    return terms.reduce((score, term) => {
      if (nameTerms.includes(term)) return score + 4;
      if (nameTerms.some((t) => t.startsWith(term) || term.startsWith(t))) return score + 2;
      if (connector.includes(term)) return score + 2;
      return text.includes(term) ? score + 1 : score;
    }, 0);
  }

  function describeTool(tool: NamespacedTool) {
    return {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema ?? { type: 'object', properties: {} },
    };
  }

  /** A bare name matching tools on several connectors returns each of them. */
  function lookUpTools(names: string[], connector: string | undefined): unknown {
    const tools: NamespacedTool[] = [];
    const notFound: string[] = [];
    for (const name of names.slice(0, MAX_SEARCH_LIMIT)) {
      const matched = deferrableTools.filter(
        (tool) =>
          tool.name === name || (tool.tool_name === name && (!connector || tool.connector_id === connector))
      );
      if (matched.length === 0) notFound.push(name);
      tools.push(...matched.filter((tool) => !tools.includes(tool)));
    }
    const notes = [
      ...(notFound.length ? [`Not found: ${notFound.join(', ')}. Search with a query instead.`] : []),
      ...(names.length > MAX_SEARCH_LIMIT ? [`Only the first ${MAX_SEARCH_LIMIT} names were looked up.`] : []),
    ];
    return { tools: tools.map(describeTool), ...(notes.length ? { note: notes.join(' ') } : {}) };
  }

  function searchDeferredTools(input: Record<string, unknown>): unknown {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    const terms = searchTerms(query);
    const connector = typeof input.connector === 'string' ? input.connector : undefined;
    const names = Array.isArray(input.names)
      ? input.names.filter((name): name is string => typeof name === 'string' && name.length > 0)
      : [];
    if (names.length > 0) {
      return lookUpTools(names, connector);
    }
    const requested = typeof input.limit === 'number' ? Math.floor(input.limit) : DEFAULT_SEARCH_LIMIT;
    const limit = Math.min(Math.max(requested || DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT);
    const exact = (tool: NamespacedTool) => query === tool.tool_name || query === tool.name;
    const matches = deferrableTools
      .filter((tool) => !connector || tool.connector_id === connector)
      .map((tool) => ({
        tool,
        score: exact(tool) ? Number.MAX_SAFE_INTEGER : terms.length ? searchScore(tool, terms) : 1,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);
    const tools = matches.slice(0, limit).map(({ tool }) => describeTool(tool));
    const note =
      matches.length === 0
        ? 'No tool matches. Try other words, or pass a connector with an empty query to list its tools.'
        : matches.length > limit
          ? `${matches.length - limit} more tools match; refine the query or raise the limit.`
          : undefined;
    return { tools, ...(note ? { note } : {}) };
  }

  function getAdvertisedTools(): OpenAITool[] {
    return advertisedTools;
  }

  function emitToolsChanged(): void {
    const detail: ToolsChangedDetail = {
      manifests,
      nativeTools,
      availableTools,
      openaiTools: getAdvertisedTools(),
    };
    window.dispatchEvent(new CustomEvent('lumo:connectors-ready', { detail }));
    window.dispatchEvent(new CustomEvent('lumo:tools-changed', { detail }));
  }

  const MCP_ID_PREFIX = 'mcp-';

  function httpUrlOf(manifest: ConnectorManifest): string | undefined {
    const transport = manifest.auth?.type === 'mcp_server' ? manifest.auth.transport : undefined;
    if (!transport || typeof transport !== 'object') return undefined;
    const { transport: kind, url } = transport as { transport?: unknown; url?: unknown };
    return kind === 'http' && typeof url === 'string' ? url : undefined;
  }

  function describeManifest(manifest: ConnectorManifest): ConnectorManifest {
    return {
      ...manifest,
      category: categoryOf(manifest.id),
      server_id: manifest.id.startsWith(MCP_ID_PREFIX)
        ? manifest.id.slice(MCP_ID_PREFIX.length)
        : undefined,
      url: httpUrlOf(manifest),
    };
  }

  async function loadRegistry(): Promise<ConnectorManifest[]> {
    if (isTauri()) {
      const registry = await tauriInvoke<ConnectorManifest[]>('get_tool_registry');
      desktopFeatureFlags = await tauriInvoke<{ experimentalConnectors: boolean }>('get_desktop_feature_flags')
        .catch(() => ({ experimentalConnectors: false }));
      manifests = registry.map(describeManifest);
      const builtins = await tauriInvoke<ToolDefinition[]>('get_builtin_tools');
      builtinTools = builtins.map((tool) => {
        const { connectorId, toolName } = parseNamespaced(tool.name);
        return { ...tool, connector_id: connectorId, tool_name: toolName };
      });
    } else {
      builtinTools = [];
      const gatewayManifests = await gatewayFetch<ConnectorManifest[]>('/registry');
      manifests = (gatewayManifests || [BROWSER_ONLY_MANIFEST]).map(describeManifest);
    }
    refreshToolLists();
    emitToolsChanged();
    return manifests;
  }

  async function init(): Promise<void> {
    await loadRegistry();

    if (isTauri()) {
      const listen =
        window.__TAURI__?.event?.listen ||
        window.__TAURI_INTERNALS__?.event?.listen;
      if (listen) {
        await listen('connector:changed', () => loadRegistry());
        await listen('connectors:changed', () => loadRegistry());
        // The user added or removed a connector in Settings. The web app counts these in
        // telemetry; it gets only the action and the kind, never which connector.
        await listen('telemetry:connector', (event) => {
          const { action, kind } = (event.payload || {}) as { action?: unknown; kind?: unknown };
          if (action !== 'added' && action !== 'removed') return;
          if (kind !== 'catalog' && kind !== 'mcp') return;
          window.dispatchEvent(new CustomEvent(`lumo:connector-${action}`, { detail: { kind } }));
        });
        await listen('tool:approval_request', (event) => {
          const p = (event.payload || {}) as ToolApprovalRequestPayload;
          window.dispatchEvent(
            new CustomEvent('lumo:tool-approval-request', {
              detail: {
                requestId: p.request_id,
                connectorId: p.connector_id,
                toolName: p.tool_name,
                input: p.input,
                ...(p.reason ? { reason: p.reason } : {}),
                ...(p.conversation_id ? { conversationId: p.conversation_id } : {}),
              },
            })
          );
        });
        await listen('tool:approval_resolved', (event) => {
          const p = (event.payload || {}) as ToolApprovalResolvedPayload;
          window.dispatchEvent(
            new CustomEvent('lumo:tool-approval-resolved', {
              detail: {
                requestId: p.request_id,
                approved: p.approved,
                ...(p.conversation_id ? { conversationId: p.conversation_id } : {}),
              },
            })
          );
        });
      }
    }
  }

  function ensureInit(): Promise<void> {
    if (!initPromise) {
      initPromise = init().catch((err) => {
        initPromise = null;
        logWarn('[LumoConnectors] init failed:', err);
        throw err;
      });
    }
    return initPromise;
  }

  function getNativeTools(): NamespacedTool[] {
    return nativeTools;
  }

  /** Tools from connectors that are enabled and authenticated (safe to offer the model). */
  function getAvailableTools(): NamespacedTool[] {
    return availableTools;
  }

  function getManifests(): ConnectorManifest[] {
    return manifests;
  }

  function getConnectors(): ConnectorManifest[] {
    return manifests.filter((c) => c.readiness?.state === 'ready');
  }

  /**
   * OpenAI Chat Completions `tools` array for inference requests. When connected services have
   * too many tools, theirs are replaced by `SEARCH_TOOL` and `CALL_TOOL`.
   */
  function getOpenAITools(): OpenAITool[] {
    return getAdvertisedTools();
  }

  /** @deprecated Prefer getOpenAITools. */
  function getFlatApiTools(): FlatApiTool[] {
    return getAdvertisedTools().map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));
  }

  function isNativeTool(name: string): boolean {
    return isToolSearchTool(name) || nativeTools.some((t) => t.name === name);
  }

  function isAvailableTool(name: string): boolean {
    const aliases: Record<string, string> = {
      browser_fetch: 'browser__fetch',
      browser_navigate: 'browser__navigate',
    };
    const resolved = aliases[name] || name;
    return isToolSearchTool(resolved) || availableTools.some((t) => t.name === resolved);
  }

  function parseNamespaced(name: string): { connectorId: string; toolName: string } {
    const aliases: Record<string, string> = {
      browser_fetch: 'browser__fetch',
      browser_navigate: 'browser__navigate',
      filesystem_fs_read: 'filesystem__fs_read',
      filesystem_fs_search: 'filesystem__fs_search',
      filesystem_fs_write: 'filesystem__fs_write',
      filesystem_fs_edit: 'filesystem__fs_edit',
      bash_run: 'bash__run',
    };
    const resolved = aliases[name] || name;
    const sep = resolved.indexOf('__');
    if (sep === -1) {
      throw new Error(`Invalid native tool name: ${name}`);
    }
    return {
      connectorId: resolved.slice(0, sep),
      toolName: resolved.slice(sep + 2),
    };
  }

  function parseToolCallArguments(raw: unknown): Record<string, unknown> {
    if (raw == null || raw === '') {
      return {};
    }
    if (typeof raw === 'object') {
      return raw as Record<string, unknown>;
    }
    try {
      return JSON.parse(raw as string) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Invalid tool call arguments JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  function serializeToolResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }
    try {
      return JSON.stringify(result);
    } catch {
      return String(result);
    }
  }

  function serializeBoundedToolError(message: string): string {
    const maxBytes = 32_000;
    const notice = '\n[Tool error truncated; middle omitted.]\n';
    const serialized = serializeToolResult({ error: message });
    const encoder = new TextEncoder();
    if (encoder.encode(serialized).length <= maxBytes) {
      return serialized;
    }

    // Measure the JSON sent to the model: escaping can make it much larger than the error text.
    const characters = Array.from(message);
    let lower = 0;
    let upper = characters.length;
    let bounded = serializeToolResult({ error: notice });
    while (lower <= upper) {
      const count = Math.floor((lower + upper) / 2);
      const tailCount = Math.floor(count / 4);
      const head = characters.slice(0, count - tailCount).join('');
      const tail = characters.slice(characters.length - tailCount).join('');
      const candidate = serializeToolResult({ error: head + notice + tail });
      if (encoder.encode(candidate).length <= maxBytes) {
        bounded = candidate;
        lower = count + 1;
      } else {
        upper = count - 1;
      }
    }
    return bounded;
  }

  /**
   * Extract tool name + args from an OpenAI-style tool call object.
   * Supports Chat Completions (`function.name`) and flat `{ name, arguments }`.
   */
  function normalizeToolCall(toolCall: ToolCall): NormalizedToolCall {
    const fn = toolCall.function || toolCall;
    const name = fn.name || toolCall.name;
    if (!name) {
      throw new Error('Tool call is missing function name');
    }
    const args = parseToolCallArguments(fn.arguments ?? toolCall.arguments);
    const id = toolCall.id || toolCall.tool_call_id || null;
    return { id, name, arguments: args };
  }

  async function dispatchNativeTool(namespacedName: string, input: unknown, scheduleContext?: ScheduleToolContext, fileTransport = false, options?: ToolCallOptions): Promise<unknown> {
    const aliases: Record<string, string> = {
      browser_fetch: 'browser__fetch',
      browser_navigate: 'browser__navigate',
      filesystem_fs_read: 'filesystem__fs_read',
      filesystem_fs_search: 'filesystem__fs_search',
      filesystem_fs_write: 'filesystem__fs_write',
      filesystem_fs_edit: 'filesystem__fs_edit',
      bash_run: 'bash__run',
    };
    const resolvedName = aliases[namespacedName] || namespacedName;
    const { connectorId, toolName } = parseNamespaced(resolvedName);

    if (isTauri()) {
      return tauriInvoke('invoke_tool', {
        connectorId,
        toolName,
        input,
        fileTransport,
        ...(scheduleContext ? { scheduleContext } : {}),
        ...(options?.conversationId ? { conversationId: options.conversationId } : {}),
      });
    }

    if (scheduleContext) throw new Error('Scheduled tool execution requires Lumo Desktop.');

    const gatewayResult = await gatewayFetch('/invoke', {
      method: 'POST',
      body: JSON.stringify({ connector_id: connectorId, tool_name: toolName, input }),
    });
    if (gatewayResult !== null) {
      return gatewayResult;
    }

    if (connectorId === 'browser' && toolName === 'fetch') {
      return browserClientFetch(input as BrowserFetchInput);
    }

    throw new Error(
      `Connector "${connectorId}" is not available in the browser. Use Lumo Desktop or connect via the Lumo web settings.`
    );
  }

  /**
   * Execute one OpenAI-format tool call and return a tool result message payload.
   */
  async function executeToolCall(toolCall: ToolCall, scheduleContext?: ScheduleToolContext, options?: ToolCallOptions): Promise<ToolResultMessage> {
    const { id, name, arguments: args } = normalizeToolCall(toolCall);

    if (isToolSearchTool(name)) {
      return executeToolSearchCall(id, name, args, scheduleContext, options);
    }

    if (!isAvailableTool(name)) {
      return {
        role: 'tool',
        tool_call_id: id,
        name,
        content: serializeToolResult({
          error: `Native tool "${name}" is not available (connector may need setup)`,
        }),
        is_error: true,
      };
    }

    try {
      const output = await dispatchNativeTool(name, args, scheduleContext, true, options);
      // Only the native invocation response owns this marker. Connector content
      // and browser/gateway fallbacks cannot supply transport metadata.
      const envelope = isTauri() ? output as { value: unknown; file_transport?: boolean } : undefined;
      const result = envelope ? envelope.value : output;
      const fileTransfer = envelope?.file_transport === true ? result : undefined;
      return {
        role: 'tool',
        tool_call_id: id,
        name,
        content: fileTransfer === undefined ? serializeToolResult(result) : '[File conversion pending]',
        ...(fileTransfer === undefined ? {} : { fileTransfer }),
      };
    } catch (err) {
      return {
        role: 'tool',
        tool_call_id: id,
        name,
        content: serializeBoundedToolError((err instanceof Error && err.message) || String(err)),
        is_error: true,
      };
    }
  }

  /**
   * Searching runs here; a call is unwrapped into the tool it names, so native sees that tool and
   * applies its policy, approvals and schedule restrictions as it would to a direct call.
   */
  async function executeToolSearchCall(
    id: string | null,
    name: string,
    args: Record<string, unknown>,
    scheduleContext?: ScheduleToolContext,
    options?: ToolCallOptions
  ): Promise<ToolResultMessage> {
    if (name === SEARCH_TOOL) {
      return { role: 'tool', tool_call_id: id, name, content: serializeToolResult(searchDeferredTools(args)) };
    }
    const requested = typeof args.name === 'string' ? args.name : '';
    const sameName = deferrableTools.filter((tool) => tool.tool_name === requested);
    const target = !isAvailableTool(requested) && sameName.length === 1 ? sameName[0]!.name : requested;
    if (!target || target === SEARCH_TOOL || target === CALL_TOOL) {
      return {
        role: 'tool',
        tool_call_id: id,
        name,
        content: serializeToolResult({ error: `Pass the name of a tool returned by ${SEARCH_TOOL}.` }),
        is_error: true,
      };
    }
    const result = await executeToolCall(
      { id, function: { name: target, arguments: args.arguments ?? {} } },
      scheduleContext,
      options
    );
    return { ...result, name };
  }

  /** Execute multiple tool calls (e.g. from one assistant turn). Runs in parallel. */
  async function executeToolCalls(toolCalls: ToolCall[], scheduleContext?: ScheduleToolContext, options?: ToolCallOptions): Promise<ToolResultMessage[]> {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return [];
    }
    return Promise.all(toolCalls.map((call) => executeToolCall(call, scheduleContext, options)));
  }

  async function connectConnector(
    connectorId: string,
    credentials?: unknown
  ): Promise<unknown> {
    if (isTauri()) {
      return tauriInvoke('connect_connector', { connectorId, credentials });
    }
    const result = await gatewayFetch('/authenticate', {
      method: 'POST',
      body: JSON.stringify({ connector_id: connectorId, credentials }),
    });
    if (result === null) {
      throw new Error('Connector authentication requires the Lumo gateway or Lumo Desktop.');
    }
    await loadRegistry();
    return result;
  }

  async function setConnectorEnabled(connectorId: string, enabled: boolean): Promise<void> {
    if (isTauri()) {
      return tauriInvoke('set_connector_enabled', { connectorId, enabled });
    }
    throw new Error('Enabling or disabling connectors requires Lumo Desktop.');
  }

  async function setToolPolicy(
    connectorId: string,
    toolName: string,
    policy: ToolPolicy
  ): Promise<void> {
    if (isTauri()) {
      return tauriInvoke('set_tool_policy', { connectorId, toolName, policy });
    }
    throw new Error('Setting tool approval policy requires Lumo Desktop.');
  }

  async function respondToolApproval(
    requestId: string,
    approved: boolean,
    always = false
  ): Promise<void> {
    if (isTauri()) {
      return tauriInvoke('respond_tool_approval', { requestId, approved, always });
    }
    throw new Error('Responding to tool approvals requires Lumo Desktop.');
  }

  const CONNECTOR_ID = /^[a-z0-9_-]{1,64}$/;

  /** See `LumoConnectorsApi.exportPdf` and `src-tauri/src/pdf_export.rs`. */
  function exportPdf(html: string, options: PdfExportOptions): Promise<PdfExportResult> {
    return tauriInvoke<PdfExportResult>('export_pdf', {
      html,
      fileName: options.fileName,
      title: options.title ?? null,
    });
  }

  /**
   * @param tab Settings tab to land on ('general' | 'connectors'); omit for the last one shown.
   * @param connectorId Connector whose details to open; implies the connectors tab.
   */
  async function openSettings(tab?: SettingsTab, connectorId?: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Opening the settings page requires Lumo Desktop.');
    }
    if (connectorId !== undefined && !CONNECTOR_ID.test(connectorId)) {
      throw new Error('Invalid connector id.');
    }
    const target = connectorId ? `${SETTINGS_CONNECTOR_TAB_PREFIX}${connectorId}` : tab;
    return tauriInvoke('open_settings_window', { source: 'app-ui', tab: target ?? null });
  }

  /** Read the latest registry snapshot after `ready`, or after a tools-changed event. */
  function getCatalog(): ConnectorCatalog {
    const entries = new Map<string, ConnectorCatalog['connectors'][number]>(
      [...BUILTIN_CONNECTORS, ...getFeaturedMcpServers(desktopFeatureFlags.experimentalConnectors)]
        .map(
          ({ iconSrc, ...entry }) => [entry.id, { ...entry, icon: connectorIcons[iconSrc], registered: false, tools: [] }]
        )
    );
    for (const manifest of manifests) {
      const preset = entries.get(manifest.id);
      // Explicit projection: manifests can contain stdio env, arguments and other auth config.
      entries.set(manifest.id, {
        id: manifest.id,
        server_id: manifest.server_id,
        category: preset?.category ?? manifest.category ?? 'custom',
        icon: manifest.icon ?? preset?.icon,
        name: manifest.display_name,
        description: manifest.description ?? preset?.description ?? '',
        url: preset?.url,
        registered: true,
        enabled: manifest.enabled !== false,
        readiness: { ...manifest.readiness },
        status: { ...manifest.status },
        tools: (manifest.tools ?? []).map(({ name, title, description, read_only }) => ({
          name, title, description, read_only,
        })),
      });
    }
    return {
      categories: CONNECTOR_CATEGORIES.map((category) => ({ ...category })),
      connectors: [...entries.values()],
    };
  }

  async function disconnectConnector(connectorId: string): Promise<unknown> {
    if (isTauri()) {
      return tauriInvoke('disconnect_connector', { connectorId });
    }
    const result = await gatewayFetch('/disconnect', {
      method: 'POST',
      body: JSON.stringify({ connector_id: connectorId }),
    });
    if (result === null) {
      throw new Error('Connector disconnect requires the Lumo gateway or Lumo Desktop.');
    }
    await loadRegistry();
    return result;
  }

  async function registerScheduleExecutionContext(input: ScheduleExecutionInput): Promise<ScheduleToolContext> {
    if (!isTauri()) throw new Error('Scheduled tool execution requires Lumo Desktop.');
    return tauriInvoke<ScheduleToolContext>('register_schedule_execution_context', input);
  }

  const connectorApi: LumoConnectorsApi = {
    ready: ensureInit(),
    init,
    loadRegistry,
    async setFeatureFlags(flags) {
      if (!isTauri()) return;
      await connectorApi.ready;
      await tauriInvoke('set_desktop_feature_flags', { flags });
      await loadRegistry();
    },
    getNativeTools,
    getAvailableTools,
    getManifests,
    getConnectors,
    setConnectorEnabled,
    setToolPolicy,
    respondToolApproval,
    getFlatApiTools,
    getOpenAITools,
    toFlatApiTool,
    toFlatApiTools,
    toOpenAITool,
    toOpenAITools,
    ensureOpenAIToolShape,
    normalizeParameters,
    isNativeTool,
    isAvailableTool,
    dispatchNativeTool,
    executeToolCall,
    executeToolCalls,
    scheduleExecutionCapabilities: { readOnlyConnectors: isTauri() },
    registerScheduleExecutionContext,
    connectConnector,
    disconnectConnector,
    openSettings,
    getCatalog,
    ...(isTauri() ? { exportPdf } : {}),
    isDesktop: isTauri(),
    isBrowser: !isTauri(),
  };

  window.LumoConnectors = connectorApi;

  // LumoAPIClient discovers native tools here when running inside Lumo Desktop.
  if (isTauri()) {
    window.__TAURI__ = window.__TAURI__ || {};
    window.__TAURI__.external_tools = {
      ready: connectorApi.ready,
      getTools: getOpenAITools,
      getOpenAITools,
      getFlatApiTools,
      getAvailableTools,
      isNativeTool: isAvailableTool,
      executeToolCall,
      executeToolCalls,
      completeFileRead: (resultId: string, value: unknown) =>
        dispatchNativeTool('tool_results__complete_file', { result_id: resultId, value }),
      scheduleExecutionCapabilities: { readOnlyConnectors: true },
      registerScheduleExecutionContext,
    };
  }

  ensureInit();
})();
