# 🎫 Ticket Manager — WebMCP Example

A simple, reactive ticket management application powered by **WebMCP** (Web Model Context Protocol). This project demonstrates how to expose a website's internal functions as structured tools that AI agents can discover and invoke programmatically.

## 🚀 Key Features

-   **Dashboard**: View all tickets with status-based color coding.
-   **Create Ticket**: Simple form to add new issues to the system.
-   **Search**: Real-time search across ID, name, description, and status.
-   **Edit Ticket**: Context-aware editing functionality with status updates.
-   **WebMCP Integration**: Native `navigator.modelContext` and [MCP-B](https://mcp-b.ai) support.

## 🛠️ WebMCP Tools Registered

The following functions are exposed as machine-readable tools for AI assistants:

-   `listTickets`: Fetches and displays all tickets.
-   `createTicket`: Programmatically creates a new ticket.
-   `searchTickets`: Searches the database via query string.
-   `updateTicket`: Saves changes to an existing ticket.
-   `navigateTo`: Switches between different application screens.

> [!NOTE]
> **Contextual Awareness**: The application uses a screen-aware registration system. For example, the `updateTicket` tool is only visible to the agent when the user is on the "Edit" screen.

## 📦 Technical Stack

-   **Frontend**: Vanilla HTML/JavaScript (ES6).
-   **Backend**: Node.js & Express server.
-   **Storage**: Simple `tickets.txt` JSON-based persistent storage.
-   **MCP SDK**: `@mcp-b/transports` and `@modelcontextprotocol/sdk`.

## 🚦 How to Run

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Start the server**:
    ```bash
    node server.js
    ```

3.  **Open the app**:
    Navigate to `http://localhost:3000` in your browser.

## 🧪 Testing with AI
To see the WebMCP tools in action, use the [MCP-B Browser Extension](https://mcp-b.ai) or a browser with native `navigator.modelContext` support. You can then ask your AI assistant to perform tasks like:
-   *"Find the ticket about the server and set it to 'done'."*
-   *"Create a new ticket for 'UI responsiveness' with a high priority description."*
