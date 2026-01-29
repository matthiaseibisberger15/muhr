const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const os = require('os');

const PORT = 8080;

// Funktion zur Ermittlung der lokalen IP-Adresse im WLAN
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIp = getLocalIp();

// Routen für Express
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/:room', (req, res) => res.sendFile(__dirname + '/index.html'));

// Speicher für alle aktiven Timer
const timerStates = {};

function getOrCreateTimer(room) {
    if (!room) return null;
    if (!timerStates[room]) {
        timerStates[room] = { starttime: 0, oldtime: 0, updatetime: Date.now() };
    }
    return timerStates[room];
}

io.on('connection', (socket) => {
    // Sobald sich ein Client verbindet, schicken wir ihm die Server-IP
    socket.emit('server-ip', { ip: localIp, port: PORT });

    socket.on('join', (roomID) => {
        if (!roomID) return;
        socket.join(roomID);
        const sw = getOrCreateTimer(roomID);
        sw.updatetime = Date.now();
        socket.emit('update', sw);
    });

    socket.on('start', (data) => {
        const sw = getOrCreateTimer(data.room);
        if (sw) {
            if (sw.starttime === 0) sw.starttime = Date.now();
            sw.updatetime = Date.now();
            io.to(data.room).emit('update', sw);
        }
    });

    socket.on('stop', (data) => {
        const sw = getOrCreateTimer(data.room);
        if (sw) {
            if (sw.starttime > 0) sw.oldtime = Date.now() - sw.starttime + sw.oldtime;
            sw.starttime = 0;
            sw.updatetime = Date.now();
            io.to(data.room).emit('update', sw);
        }
    });

    socket.on('reset', (data) => {
        const sw = getOrCreateTimer(data.room);
        if (sw) {
            sw.starttime = sw.starttime > 0 ? Date.now() : 0;
            sw.oldtime = 0;
            sw.updatetime = Date.now();
            io.to(data.room).emit('update', sw);
        }
    });
});

server.listen(PORT, () => {
    console.log(`=== MaturaUHR Server gestartet ===`);
    console.log(`Lokal: http://localhost:${PORT}`);
    console.log(`Netzwerk (für Handy): http://${localIp}:${PORT}`);
    console.log(`==================================`);
});