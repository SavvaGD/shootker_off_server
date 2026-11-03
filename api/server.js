export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Глобальное состояние (живет в памяти функции)
  if (!global.players) global.players = {};
  if (!global.messages) global.messages = {};
  if (!global.currentMap) global.currentMap = 0;
  if (!global.nextId) global.nextId = 1;

  const url = req.url.split('?')[0];

  // 1. Получение ID
  if (url === '/api/connect') {
    const id = global.nextId++;
    global.players[id] = { id, hp: 10 };
    global.messages[id] = [];
    return res.status(200).json({ id: id, map: global.currentMap });
  }

  // 2. Отправка данных (Стейт/Выстрел)
  if (url === '/api/send' && req.method === 'POST') {
    const data = req.body;
    const senderId = data.id;
    
    if (data.type === 'state') {
      global.players[senderId] = { ...global.players[senderId], ...data };
    }
    
    for (let id in global.players) {
      if (parseInt(id) !== senderId) {
        global.messages[id].push(data);
      }
    }
    return res.status(200).send('OK');
  }

  // 3. Получение данных (Long Polling)
  if (url === '/api/receive') {
    const id = parseInt(req.query.id);
    const start = Date.now();
    
    while (Date.now() - start < 10000) {
      if (global.messages[id] && global.messages[id].length > 0) {
        const msgs = global.messages[id];
        global.messages[id] = [];
        return res.status(200).json(msgs);
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return res.status(200).json([]);
  }

  // 4. Админка
  if (url === '/api/admin' && req.method === 'POST') {
    const data = req.body;
    if (data.action === 'map') {
      global.currentMap = data.mapId;
      for (let id in global.players) global.messages[id].push({ type: 'map', mapId: data.mapId });
    } else if (data.action === 'restart') {
      for (let id in global.players) global.messages[id].push({ type: 'respawn' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(404).send('Not found');
}
