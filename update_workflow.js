const fs = require('fs');

const FILE_PATH = 'scripts/n8n/telegram-notifications-db-workflow.json';

const STATIC_STATION_COORDS_CODE = `const STATIC_STATION_COORDS = {
  ESIBE22E0001001: { lat: 38.341118679046346, lon: -0.7654778230267333 },
  ESIBE22E0001002: { lat: 38.3476704, lon: -0.7691027 },
  ESIBE22E0001003: { lat: 38.3498799, lon: -0.7649660 },
  ESIBE22E0001004: { lat: 38.3430059, lon: -0.7610202 },
  ESIBE22E0001005: { lat: 38.3385331, lon: -0.7766776 },
  'IBERDROLA-5629': { lat: 38.3810859, lon: -0.7308562 },
  ESIBE22E0005629: { lat: 38.3810859, lon: -0.7308562 }
};`;

const HELPERS_CODE = `async function getStationCoords(stationId) {
  try {
    const rows = await supabaseGet.call(this, 'charger_current_status?select=station_id,latitude,longitude&station_id=eq.' + encodeURIComponent(stationId) + '&limit=1');
    if (rows.length) {
      const row = rows[0] || {};
      if (Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))) {
        return { lat: Number(row.latitude), lon: Number(row.longitude) };
      }
    }
  } catch (e) {}
  try {
    const rows = await supabaseGet.call(this, 'charger_current_status?select=station_id,lat,lng&station_id=eq.' + encodeURIComponent(stationId) + '&limit=1');
    if (rows.length) {
      const row = rows[0] || {};
      if (Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) {
        return { lat: Number(row.lat), lon: Number(row.lng) };
      }
    }
  } catch (e) {}
  const staticCoords = STATIC_STATION_COORDS[String(stationId || '')];
  if (staticCoords && Number.isFinite(Number(staticCoords.lat)) && Number.isFinite(Number(staticCoords.lon))) {
    return { lat: Number(staticCoords.lat), lon: Number(staticCoords.lon) };
  }
  return null;
}

async function sendTelegramLocation(chatId, stationId) {
  const coords = await getStationCoords.call(this, stationId);
  if (!coords) return false;
  const response = await requestText.call(this, 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendLocation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), latitude: coords.lat, longitude: coords.lon })
  });
  if (!response.ok) throw new Error('Telegram sendLocation fallo: ' + response.status + ' ' + response.body);
  return true;
}`;

function updateNodeCode(code, name) {
  let newCode = code;

  // Insert STATIC_STATION_COORDS after PUBLIC_BASE_URL if it doesn't exist
  if (!newCode.includes('STATIC_STATION_COORDS')) {
    const regex = /(const PUBLIC_BASE_URL = [^;]+;)/;
    if (regex.test(newCode)) {
      newCode = newCode.replace(regex, `$1\n${STATIC_STATION_COORDS_CODE}`);
    }
  }

  // Insert helpers before sendTelegram if they don't exist
  if (!newCode.includes('async function getStationCoords')) {
    const regex = /(async function sendTelegram)/;
    if (regex.test(newCode)) {
      newCode = newCode.replace(regex, `${HELPERS_CODE}\n\n$1`);
    }
  }

  // Insert sendTelegramLocation call
  if (name === "Procesar y enviar premium") {
    const target = 'await sendTelegram.call(this, chatId, buildMessage(eventItem), buildNotificationKeyboard(eventItem));';
    if (newCode.includes(target) && !newCode.includes('await sendTelegramLocation.call(this, chatId, eventItem.stationId);')) {
      newCode = newCode.replace(target, `await sendTelegramLocation.call(this, chatId, eventItem.stationId);\n    ${target}`);
    }
  } else if (name === "Enviar regular") {
    const target = 'await sendTelegram.call(this, item.telegramChatId, buildMessage(item), buildNotificationKeyboard(item));';
    if (newCode.includes(target) && !newCode.includes('await sendTelegramLocation.call(this, item.telegramChatId, item.stationId);')) {
      newCode = newCode.replace(target, `await sendTelegramLocation.call(this, item.telegramChatId, item.stationId);\n      ${target}`);
    }
  }

  return newCode;
}

const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

data.nodes.forEach(node => {
  if (node.name === "Procesar y enviar premium" || node.name === "Enviar regular") {
    if (node.parameters && node.parameters.jsCode) {
      node.parameters.jsCode = updateNodeCode(node.parameters.jsCode, node.name);
    }
  }
});

fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2) + '\n');
console.log('Update complete.');
