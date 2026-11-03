export const config = {
  runtime: 'edge',
};

// Хранилище подключенных клиентов (в памяти Edge-функции)
const clients = new Map<number, ReadableStreamDefaultController>();
let nextId = 1;

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // Обработка POST-запроса (отправка данных от игрока)
  if (req.method === 'POST') {
    try {
      const data = await req.json();
      const senderId = data.id;

      // Рассылаем всем, кроме отправителя
      const encoder = new TextEncoder();
      const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

      clients.forEach((controller, id) => {
        if (id !== senderId) {
          try {
            controller.enqueue(message);
          } catch (e) {
            clients.delete(id);
          }
        }
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response('Bad Request', { status: 400 });
    }
  }

  // Обработка GET-запроса (подключение клиента через SSE)
  if (req.method === 'GET') {
    const myId = nextId++;
    let controller: ReadableStreamDefaultController;

    const stream = new ReadableStream({
      start(c) {
        controller = c;
        clients.set(myId, controller);

        // Отправляем клиенту его ID
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: {"type":"id","id":${myId}}\n\n`));
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

  return new Response('Method Not Allowed', { status: 405 });
}
