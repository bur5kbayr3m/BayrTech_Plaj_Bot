const axios = require('axios');

const URL = 'http://localhost:3000/webhook';
const PHONE = '905524948091'; // Test numarası

async function sendWebhook(messageData) {
  try {
    await axios.post(URL, {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [messageData]
          }
        }]
      }]
    });
    console.log('👉 Simülasyon isteği gönderildi.\n');
  } catch (error) {
    console.error('❌ Hata:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('Sunucuya ulaşılamadı. Lütfen başka bir terminalde "npm start" komutu ile sunucuyu başlattığınızdan emin olun.');
    }
  }
}

async function runSimulation() {
  console.log('--- TEST 1: Kullanıcı botu başlatmak için "Merhaba" yazıyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'text',
    text: { body: 'Merhaba' }
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('--- TEST 2: Kullanıcı listeden "Bugün" (bugun) seçeneğini seçiyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: {
      type: 'list_reply',
      list_reply: { id: 'bugun', title: 'Bugün (Cuma)' }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('--- TEST 3: Kullanıcı sefer listesinden "Hacıosman 10:30" (sefer_gidis_hac_1030) seçeneğini seçiyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: {
      type: 'list_reply',
      list_reply: { id: 'sefer_gidis_hac_1030', title: 'Hacıosman 10:30' }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('--- TEST 4: Kullanıcı kişi sayısı listesinden "2 Kişi" (kisi_2) seçeneğini seçiyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: {
      type: 'list_reply',
      list_reply: { id: 'kisi_2', title: '2 Kişi' }
    }
  });

  console.log('🎉 Simülasyon tamamlandı. Sunucunuzun açık olduğu terminalden botun verdiği yanıtları (konsol çıktılarını) ve Supabase veritabanını kontrol edebilirsiniz.');
}

runSimulation();
