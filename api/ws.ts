export const config = { runtime: 'edge' };

// Глобальное состояние (в памяти Vercel)
let players: Record<number, any> = {};
let messages: Record<number, any[]> = {};
let lastActivity = Date.now();
let currentMap = 0;

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const myId = parseInt(url.searchParams.get('id') || '0');

  // 1. Подключение игрока (получение ID и карты)
  if (url.pathname === '/api/connect') {
    const newId = Math.floor(Math.random() * 10000) + 1; // Случайный ID
    players[newId] = { id: newId, hp: 10, x: 0, y: 0, z: 0 };
    messages[newId] = [];
    
    return new Response(JSON.stringify({ id: newId, map: currentMap }), {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 2. Отправка данных от игрока (состояние, выстрел)
  if (url.pathname === '/api/send' && req.method === 'POST') {
    const data = await req.json();
    const senderId = data.id;
    
    // Обновляем состояние игрока
    if (data.type === 'state') players[senderId] = { ...players[senderId], ...data };
    
    // Кладем сообщение в очередь всем остальным
    for (let id in players) {
      if (parseInt(id) !== senderId) {
        messages[id].push(data);
      }
    }
    return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // 3. Получение данных (Long Polling)
  if (url.pathname === '/api/receive') {
    const start = Date.now();
    
    // Ждем до 10 секунд появления новых сообщений
    while (Date.now() - start < 10000) {
      if (messages[myId] && messages[myId].length > 0) {
        const msgs = messages[myId];
        messages[myId] = []; // Очищаем
        return new Response(JSON.stringify(msgs), {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
      await new Promise(r => setTimeout(r, 100)); // Спим 100мс
    }
    
    // Если ничего не пришло — возвращаем пустой массив (игрок сразу спросит снова)
    return new Response(JSON.stringify([]), {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  return new Response('Not Found', { status: 404 });
}
