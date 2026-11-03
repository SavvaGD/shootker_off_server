export default async function handler(req: any, res: any) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Инициализируем "глобальную" память (она живет, пока функция не заснет)
  if (!global.players) global.players = {};
  if (!global.messages) global.messages = {};
  if (!global.currentMap) global.currentMap = 0;
  if (!global.nextId) global.nextId = 1;

  // Получаем путь запроса (например, '/api/admin' или '/api/send')
  const url = req.url.split('?')[0];

  // --- 1. КОННЕКТ (Выдача ID) ---
  if (url === '/api/connect') {
    const id = global.nextId++;
    global.players[id] = { id, hp: 10 };
    global.messages[id] = [];
    return res.status(200).json({ id: id, map: global.currentMap });
  }

  // --- 2. ПРИЕМ ДАННЫХ ОТ ИГРОКА ---
  if (url === '/api/send' && req.method === 'POST') {
    const buffers = [];
    for await (const chunk of req) { buffers.push(chunk); }
    let data;
    try { data = JSON.parse(Buffer.concat(buffers).toString()); } catch (e) { return res.status(400).send('Invalid JSON'); }

    const senderId = data.id;
    if (data.type === 'state') global.players[senderId] = { ...global.players[senderId], ...data };
    
    for (let id in global.players) {
      if (parseInt(id) !== senderId) {
        if (!global.messages[id]) global.messages[id] = [];
        global.messages[id].push(data);
      }
    }
    return res.status(200).send('OK');
  }

  // --- 3. ПОЛУЧЕНИЕ ДАННЫХ (Long Polling) ---
  if (url === '/api/receive') {
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).send('No ID');

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

  // --- 4. АДМИНКА (Кнопки на сайте) ---
  if (url === '/api/admin' && req.method === 'POST') {
    const buffers = [];
    for await (const chunk of req) { buffers.push(chunk); }
    let data;
    try { data = JSON.parse(Buffer.concat(buffers).toString()); } catch (e) { return res.status(400).send('Invalid JSON'); }

    if (data.action === 'map') {
      global.currentMap = data.mapId;
      for (let id in global.players) {
        if (!global.messages[id]) global.messages[id] = [];
        global.messages[id].push({ type: 'map', mapId: data.mapId });
      }
    } else if (data.action === 'restart') {
      for (let id in global.players) {
        if (!global.messages[id]) global.messages[id] = [];
        global.messages[id].push({ type: 'respawn' });
      }
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(404).send('Not Found');
}
