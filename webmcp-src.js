/**
 * webmcp-src.js
 * Web MCP integration for Ticket Manager.
 *
 * Two parallel registrations:
 *  (A) navigator.modelContext  – native Web MCP API (Chrome 146+, requires HTTPS/localhost)
 *      → Screen-aware: only the relevant subset of tools is registered at any time.
 *  (B) MCP-B TabServerTransport – works via the MCP-B Chrome extension
 *      → All tools always available; handlers navigate to the right screen automatically.
 */

import { TabServerTransport } from '@mcp-b/transports';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/* ─────────────────────────────────────────────────────────────────────────────
   (A) navigator.modelContext — screen-specific tool definitions
   Each screen lists only the tools that are contextually relevant to it.
───────────────────────────────────────────────────────────────────────────── */

const SCREEN_TOOLS = {

    dashboard: {
        listTickets: {
            description: 'Fetch and display all tickets currently in the system.',
            inputSchema: { type: 'object', properties: {} },
            execute: async () => {
                const r = await fetch('/api/tickets');
                const tickets = await r.json();
                return { content: [{ type: 'text', text: JSON.stringify(tickets, null, 2) }] };
            }
        },
        editTicket: {
            description: 'Open the edit form for a specific ticket by its ID.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'The numeric ID of the ticket to edit.' }
                },
                required: ['id']
            },
            execute: async ({ id }) => {
                await window.openEditScreen(id);
                return { content: [{ type: 'text', text: `Edit screen opened for ticket #${id}` }] };
            }
        },
        navigateTo: {
            description: 'Navigate to the Create Ticket or Search screen.',
            inputSchema: {
                type: 'object',
                properties: {
                    screen: { type: 'string', enum: ['create', 'search'], description: 'Target screen name.' }
                },
                required: ['screen']
            },
            execute: async ({ screen }) => {
                window.showScreen(screen);
                return { content: [{ type: 'text', text: `Navigated to "${screen}"` }] };
            }
        }
    },

    create: {
        createTicket: {
            description: 'Create a new support ticket with the given name, description and status.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Short summary of the issue.' },
                    description: { type: 'string', description: 'Full description of the issue.' },
                    status: { type: 'string', enum: ['new', 'assigned', 'done', 'escalate'], description: 'Initial status.' }
                },
                required: ['name', 'description', 'status']
            },
            execute: async ({ name, description, status }) => {
                const r = await fetch('/api/tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, status })
                });
                const ticket = await r.json();
                window.showScreen('dashboard');
                return { content: [{ type: 'text', text: `Ticket created: ${JSON.stringify(ticket)}` }] };
            }
        },
        navigateTo: {
            description: 'Navigate to the Dashboard or Search screen.',
            inputSchema: {
                type: 'object',
                properties: {
                    screen: { type: 'string', enum: ['dashboard', 'search'] }
                },
                required: ['screen']
            },
            execute: async ({ screen }) => {
                window.showScreen(screen);
                return { content: [{ type: 'text', text: `Navigated to "${screen}"` }] };
            }
        }
    },

    search: {
        searchTickets: {
            description: 'Search tickets by any combination of ID, name, description or status.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query string.' }
                },
                required: ['query']
            },
            execute: async ({ query }) => {
                // Also drive the UI so the user can see the results
                document.getElementById('search-input').value = query;
                window.doSearch();
                const r = await fetch(`/api/tickets/search?q=${encodeURIComponent(query)}`);
                const tickets = await r.json();
                return { content: [{ type: 'text', text: JSON.stringify(tickets, null, 2) }] };
            }
        },
        navigateTo: {
            description: 'Navigate to the Dashboard or Create screen.',
            inputSchema: {
                type: 'object',
                properties: {
                    screen: { type: 'string', enum: ['dashboard', 'create'] }
                },
                required: ['screen']
            },
            execute: async ({ screen }) => {
                window.showScreen(screen);
                return { content: [{ type: 'text', text: `Navigated to "${screen}"` }] };
            }
        }
    },

    edit: {
        updateTicket: {
            description: 'Save updated values for the ticket currently being edited.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'ID of the ticket to update.' },
                    name: { type: 'string', description: 'New ticket name.' },
                    description: { type: 'string', description: 'New ticket description.' },
                    status: { type: 'string', enum: ['new', 'assigned', 'done', 'escalate'] }
                },
                required: ['id', 'name', 'description', 'status']
            },
            execute: async ({ id, name, description, status }) => {
                const r = await fetch(`/api/tickets/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, status })
                });
                const ticket = await r.json();
                window.showScreen('dashboard');
                return { content: [{ type: 'text', text: `Ticket updated: ${JSON.stringify(ticket)}` }] };
            }
        },
        cancelEdit: {
            description: 'Cancel editing the current ticket and return to the Dashboard.',
            inputSchema: { type: 'object', properties: {} },
            execute: async () => {
                window.cancelEdit();
                return { content: [{ type: 'text', text: 'Edit cancelled. Returned to Dashboard.' }] };
            }
        }
    }
};

/* ── navigator.modelContext management ─────────────────────────────────────── */
let _activeToolNames = [];

async function updateNavigatorModelContext(screen) {
    if (!navigator.modelContext) return;

    try {
        // Unregister all previously active tools
        for (const name of _activeToolNames) {
            try { await navigator.modelContext.unregisterTool(name); } catch (_) { }
        }
        _activeToolNames = [];

        const tools = SCREEN_TOOLS[screen] || {};
        for (const [name, { description, inputSchema, execute }] of Object.entries(tools)) {
            await navigator.modelContext.registerTool({ name, description, inputSchema, execute });
            _activeToolNames.push(name);
        }

        console.log(`[WebMCP] navigator.modelContext — screen "${screen}" | tools:`, _activeToolNames);
        _setStatus('native', true, _activeToolNames);
    } catch (err) {
        console.error('[WebMCP] navigator.modelContext error:', err);
        _setStatus('native', false, []);
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   (B) MCP-B TabServerTransport — all tools, always connected
       Handlers navigate the UI automatically when needed.
───────────────────────────────────────────────────────────────────────────── */

function buildMcpBServer() {
    const server = new McpServer({ name: 'ticket-manager', version: '1.0.0' });

    /* navigate */
    server.tool(
        'navigateTo',
        'Navigate to a screen: dashboard, create, or search.',
        { screen: z.enum(['dashboard', 'create', 'search']).describe('Target screen') },
        async ({ screen }) => {
            window.showScreen(screen);
            return { content: [{ type: 'text', text: `Navigated to "${screen}"` }] };
        }
    );

    /* list */
    server.tool(
        'listTickets',
        'Return all tickets as JSON. Also navigates to the Dashboard.',
        {},
        async () => {
            window.showScreen('dashboard');
            const r = await fetch('/api/tickets');
            return { content: [{ type: 'text', text: JSON.stringify(await r.json(), null, 2) }] };
        }
    );

    /* create */
    server.tool(
        'createTicket',
        'Create a new support ticket.',
        {
            name: z.string().describe('Short summary'),
            description: z.string().describe('Full description'),
            status: z.enum(['new', 'assigned', 'done', 'escalate']).describe('Initial status')
        },
        async ({ name, description, status }) => {
            const r = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, status })
            });
            const ticket = await r.json();
            window.showScreen('dashboard');
            return { content: [{ type: 'text', text: `Created: ${JSON.stringify(ticket)}` }] };
        }
    );

    /* search */
    server.tool(
        'searchTickets',
        'Search tickets by ID, name, description or status. Returns matching tickets as JSON.',
        { query: z.string().describe('Search string') },
        async ({ query }) => {
            window.showScreen('search');
            document.getElementById('search-input').value = query;
            window.doSearch();
            const r = await fetch(`/api/tickets/search?q=${encodeURIComponent(query)}`);
            return { content: [{ type: 'text', text: JSON.stringify(await r.json(), null, 2) }] };
        }
    );

    /* edit (open form) */
    server.tool(
        'openEditTicket',
        'Open the edit form for a ticket by its numeric ID.',
        { id: z.number().describe('Ticket ID') },
        async ({ id }) => {
            await window.openEditScreen(id);
            return { content: [{ type: 'text', text: `Edit form opened for ticket #${id}` }] };
        }
    );

    /* update */
    server.tool(
        'updateTicket',
        'Update an existing ticket by ID.',
        {
            id: z.number().describe('Ticket ID'),
            name: z.string().describe('New name'),
            description: z.string().describe('New description'),
            status: z.enum(['new', 'assigned', 'done', 'escalate']).describe('New status')
        },
        async ({ id, name, description, status }) => {
            const r = await fetch(`/api/tickets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, status })
            });
            const ticket = await r.json();
            window.showScreen('dashboard');
            return { content: [{ type: 'text', text: `Updated: ${JSON.stringify(ticket)}` }] };
        }
    );

    /* cancel edit */
    server.tool(
        'cancelEdit',
        'Cancel the current edit operation and return to the Dashboard.',
        {},
        async () => {
            window.cancelEdit();
            return { content: [{ type: 'text', text: 'Edit cancelled.' }] };
        }
    );

    return server;
}

async function initMcpB() {
    try {
        const server = buildMcpBServer();
        const transport = new TabServerTransport();
        await server.connect(transport);
        console.log('[WebMCP] ✅ MCP-B TabServer connected');
        _setStatus('mcpb', true, null);
    } catch (err) {
        console.warn('[WebMCP] MCP-B not available (install the Chrome extension):', err.message);
        _setStatus('mcpb', false, null);
    }
}

/* ── Status badge helper ────────────────────────────────────────────────────── */
function _setStatus(type, ok, tools) {
    const panel = document.getElementById('webmcp-panel');
    if (!panel) return;
    if (type === 'native') {
        document.getElementById('wm-native-dot').className = ok ? 'wm-dot wm-ok' : 'wm-dot wm-off';
        document.getElementById('wm-native-text').textContent = ok
            ? `navigator.modelContext ✓  [${tools.join(', ')}]`
            : 'navigator.modelContext  (not supported)';
    }
    if (type === 'mcpb') {
        document.getElementById('wm-mcpb-dot').className = ok ? 'wm-dot wm-ok' : 'wm-dot wm-off';
        document.getElementById('wm-mcpb-text').textContent = ok
            ? 'MCP-B TabServer  ✓  (extension connected)'
            : 'MCP-B TabServer  ✗  (install MCP-B extension)';
    }
}

/* ── Public API (called by index.html) ─────────────────────────────────────── */
window.updateWebMcpContext = updateNavigatorModelContext;

/* ── Bootstrap ──────────────────────────────────────────────────────────────── */
initMcpB();
updateNavigatorModelContext('dashboard');   // register dashboard tools on load
