export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // Читаем тело запроса
  const buffers = [];
  for await (const chunk of req) { buffers.push(chunk); }
  let data;
  try { data = JSON.parse(Buffer.concat(buffers).toString()); } catch (e) { return res.status(400).send('Invalid JSON'); }

  // Инициализация памяти (если ее нет)
  if (!global.messages) global.messages = {};
  if (!global.players) global.players = {};
  if (!global.currentMap) global.currentMap = 0;

  // Обработка команд
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
