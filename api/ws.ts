export const config = {
  runtime: 'edge',
};

// Глобальное состояние (сбрасывается, если сервер засыпает)
let currentMap = 0; // 0 = Forest, 1 = Abandonment, 2 = Village
let restartFlag = false;
let clients = new Map<number, ReadableStreamDefaultController>();
let nextId = 1;

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // 1. ОБРАБОТКА ЗАПРОСОВ ОТ АДМИНКИ (POST)
  if (req.method === 'POST' && url.pathname === '/api/admin') {
    try {
      const data = await req.json();
      
      if (data.action === 'map' && data.mapId !== undefined) {
        currentMap = data.mapId;
        broadcast({ type: 'map', mapId: currentMap });
        return new Response(JSON.stringify({ ok: true, map: currentMap }), { status: 200 });
      }
      
      if (data.action === 'restart') {
        restartFlag = true;
        broadcast({ type: 'respawn' });
        return new Response(JSON.stringify({ ok: true, msg: 'Game Restarted' }), { status: 200 });
      }
      
      return new Response('Invalid action', { status: 400 });
    } catch (e) {
      return new Response('Bad Request', { status: 400 });
    }
  }

  // 2. ОБРАБОТКА ПОДКЛЮЧЕНИЯ ИГРОКОВ (GET /api/ws)
  if (req.method === 'GET' && url.pathname === '/api/ws') {
    const myId = nextId++;
    let controller: ReadableStreamDefaultController;

    const stream = new ReadableStream({
      start(c) {
        controller = c;
        clients.set(myId, controller);

        const encoder = new TextEncoder();
        // Отправляем игроку его ID и текущую карту
        controller.enqueue(encoder.encode(`data: {"type":"id","id":${myId}}\n\n`));
        controller.enqueue(encoder.encode(`data: {"type":"map","mapId":${currentMap}}\n\n`));
      },
      cancel() {
        clients.delete(myId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // 3. ОБРАБОТКА ДАННЫХ ОТ ИГРОКОВ (POST /api/ws)
  if (req.method === 'POST' && url.pathname === '/api/ws') {
    try {
      const data = await req.json();
      const senderId = data.id;

      // Пересылаем всем, кроме отправителя
      const encoder = new TextEncoder();
      const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

      clients.forEach((controller, id) => {
        if (id !== senderId) {
          try { controller.enqueue(message); } catch (e) { clients.delete(id); }
        }
      });

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e) {
      return new Response('Bad Request', { status: 400 });
    }
  }

  return new Response('Not Found', { status: 404 });
}

// Вспомогательная функция для рассылки
function broadcast(data: any) {
  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  clients.forEach((controller, id) => {
    try { controller.enqueue(message); } catch (e) { clients.delete(id); }
  });
}
