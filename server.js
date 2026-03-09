const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'tickets.txt');

app.use(express.json());
app.use(express.static(__dirname));

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([
        { id: 1, name: 'Server is down', description: 'Production server is not responding to requests.', status: 'new' },
        { id: 2, name: 'Login page broken', description: 'Users cannot log into the portal - getting 403 error.', status: 'assigned' },
        { id: 3, name: 'Password reset not working', description: 'Reset email is not being sent to users.', status: 'done' },
        { id: 4, name: 'DB connection timeout', description: 'Database connections timing out after 30 seconds.', status: 'escalate' }
    ], null, 2));
}

function readTickets() {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
}

function writeTickets(tickets) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2));
}

// GET all tickets
app.get('/api/tickets', (req, res) => {
    res.json(readTickets());
});

// POST create ticket
app.post('/api/tickets', (req, res) => {
    const tickets = readTickets();
    const { name, description, status } = req.body;
    if (!name || !description || !status) {
        return res.status(400).json({ error: 'Name, description and status are required.' });
    }
    const nextId = tickets.length > 0 ? Math.max(...tickets.map(t => t.id)) + 1 : 1;
    const newTicket = { id: nextId, name, description, status };
    tickets.push(newTicket);
    writeTickets(tickets);
    res.status(201).json(newTicket);
});

// PUT update ticket by id
app.put('/api/tickets/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { name, description, status } = req.body;
    if (!name || !description || !status) {
        return res.status(400).json({ error: 'Name, description and status are required.' });
    }
    const tickets = readTickets();
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) {
        return res.status(404).json({ error: `Ticket #${id} not found.` });
    }
    tickets[idx] = { id, name, description, status };
    writeTickets(tickets);
    res.json(tickets[idx]);
});

// GET search tickets
app.get('/api/tickets/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    const tickets = readTickets();
    const results = tickets.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        String(t.id).includes(q)
    );
    res.json(results);
});

app.listen(PORT, () => {
    console.log(`Ticket Manager running at http://localhost:${PORT}`);
});
