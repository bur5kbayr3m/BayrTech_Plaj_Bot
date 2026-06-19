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
    console.log('👉 İsteği gönderildi.\n');
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

async function runSimulation() {
  console.log('--- TEST 1: Kullanıcı botu başlatmak için "Merhaba" yazıyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'text',
    text: { body: 'Merhaba' }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST 2: Kullanıcı Ana Menüden "Rezervasyon Yap" seçiyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'menu_rezervasyon', title: '📅 Rezervasyon Yap' } }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST 3: Kullanıcı günlerden "Bugün" seçiyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'bugun', title: 'Bugün (Cuma)' } }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST 4: Kullanıcı sefer seçiyor (Hacıosman) ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'sefer_gidis_hac_1030', title: 'Hacıosman 10:30' } }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST 5: Kullanıcı SADECE ERKEK grubunu seçerek engellemeyi test ediyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'grup_erkek_iptal', title: '👨 Sadece Erkek' } }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST 6: Kullanıcı tekrar Merhaba diyip kaldığı yerden devam ediyor ---');
  await sendWebhook({ from: PHONE, type: 'text', text: { body: 'Merhaba' } });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await sendWebhook({ from: PHONE, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'menu_rezervasyon', title: 'Rezervasyon' } } });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await sendWebhook({ from: PHONE, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'bugun', title: 'Bugün' } } });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await sendWebhook({ from: PHONE, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'sefer_gidis_mcd_0800', title: 'Mecidiyeköy 08:00' } } });
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('--- TEST 7: Kullanıcı Karma Grup seçiyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'grup_karma_2', title: '👫 1 Kadın 1 Erkek' } }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST 8: Kullanıcı ismini giriyor ---');
  await sendWebhook({
    from: PHONE,
    type: 'text',
    text: { body: 'Burak Bayram' }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🎉 Simülasyon tamamlandı.');
}

runSimulation();
