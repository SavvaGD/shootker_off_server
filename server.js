const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let clients = new Map();
let nextId = 1;

console.log("WebSocket Server started on port 8080");

wss.on('connection', (ws) => {
    const myId = nextId++;
    clients.set(myId, ws);
    console.log(`Player ${myId} connected. Total: ${clients.size}`);

    // Отправляем ID игроку
    ws.send(JSON.stringify({ type: 'id', id: myId }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Пересылаем данные всем остальным
            clients.forEach((client, id) => {
                if (id !== myId && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (e) {
            console.error("Invalid JSON:", message);
        }
    });

    ws.on('close', () => {
        clients.delete(myId);
        console.log(`Player ${myId} disconnected. Total: ${clients.size}`);
        
        // Сообщаем остальным, что игрок вышел
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'disconnect', id: myId }));
            }
        });
    });
});