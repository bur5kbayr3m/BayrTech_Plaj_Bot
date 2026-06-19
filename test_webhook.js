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

  console.log('🎉 Simülasyon tamamlandı.');
}

runSimulation();
