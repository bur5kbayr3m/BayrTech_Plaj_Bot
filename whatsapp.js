const axios = require('axios');
require('dotenv').config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const DEMO_MODE = process.env.DEMO_MODE === 'true';

const api = (!DEMO_MODE && WHATSAPP_TOKEN && WHATSAPP_PHONE_ID)
  ? axios.create({
      baseURL: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
  : null;

async function sendMessage(data) {
  if (DEMO_MODE || !api) {
    console.log('[DEMO] WhatsApp payload:', JSON.stringify(data, null, 2));
    return { demo: true, message: data };
  }

  try {
    const response = await api.post('/messages', data);
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function sendWelcomeMessage(phone) {
  const welcomeText = `MERHABA 🌴

⚠️ Plajımıza damsız giriş yapılamamaktadır.

🚐 SHUTTLE (TEK YÖN): 
Hacıosman: 300₺
Mecidiyeköy: 350 ₺

Rezervasyon için:
Durak – Kişi Sayısı – Saat – İsim yazmanız yeterlidir.
Rezervasyonlar 1 gün önceden alınır.

🏖️ PLAJ GİRİŞ ÜCRETİ
Hafta İçi: 800₺
Hafta Sonu: 1200₺

(Şezlong, şemsiye, otopark, duş ve WC dahildir.)
0-6 yaş ücretsiz
7-12 yaş: yarı fiyat

❗️Bilgileri lütfen bu mesajdan sonra gönderiniz.`;

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: welcomeText }
  };
  return sendMessage(data);
}

async function sendMainMenu(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "🏖️ X Plaj Servisine Hoş Geldiniz!"
      },
      body: {
        text: "Size nasıl yardımcı olabilirim? Lütfen menüden bir işlem seçin:"
      },
      action: {
        button: "Menüyü Aç",
        sections: [
          {
            title: "İşlemler",
            rows: [
              { id: "menu_rezervasyon", title: "📅 Rezervasyon Yap" },
              { id: "menu_sss", title: "❓ Sıkça Sorulan Sorular" },
              { id: "menu_canli_destek", title: "🎧 Canlı Destek" }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

function getTurkeyTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 3));
}

const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

async function sendDaySelectionList(phone) {
  const t = getTurkeyTime();
  const d0 = TR_DAYS[t.getDay()];
  const d1 = TR_DAYS[(t.getDay() + 1) % 7];
  const d2 = TR_DAYS[(t.getDay() + 2) % 7];
  const d3 = TR_DAYS[(t.getDay() + 3) % 7];
  const d4 = TR_DAYS[(t.getDay() + 4) % 7];

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "📅 Rezervasyon Günü" },
      body: { text: "Lütfen rezervasyon yapmak istediğiniz günü seçin:" },
      action: {
        button: "Gün Seçin",
        sections: [
          {
            title: "Önümüzdeki Günler",
            rows: [
              { id: "day_bugun", title: `Bugün (${d0})` },
              { id: "day_yarin", title: `Yarın (${d1})` },
              { id: "day_gun3", title: d2 },
              { id: "day_gun4", title: d3 },
              { id: "day_gun5", title: d4 }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendFaqList(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "❓ Sıkça Sorulan Sorular"
      },
      body: {
        text: "Cevabını öğrenmek istediğiniz soruyu seçin:"
      },
      action: {
        button: "Sorular",
        sections: [
          {
            title: "Sıkça Sorulan Sorular",
            rows: [
              { id: "faq_iptal", title: "İptal Şartları Neler?" },
              { id: "faq_evcil", title: "Evcil Hayvan Girebilir mi?" },
              { id: "faq_yemek", title: "Dışarıdan Yiyecek İçecek?" },
              { id: "faq_konum", title: "Konum Bilgisi Alabilir Miyim?" }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendFaqAnswer(phone, faqId) {
  let answer = "";
  if (faqId === 'faq_iptal') {
    answer = "İptal işlemleri için en geç 1 gün öncesinden haber vermeniz gerekmektedir. Aynı gün yapılan iptallerde ücret iadesi yapılmaz.";
  } else if (faqId === 'faq_evcil') {
    answer = "Plajımıza maalesef evcil hayvan kabul edemiyoruz. Anlayışınız için teşekkür ederiz.";
  } else if (faqId === 'faq_yemek') {
    answer = "Plaj alanımıza dışarıdan yiyecek ve içecek getirilmesi yasaktır. İçeride restoran ve kafemiz mevcuttur.";
  } else if (faqId === 'faq_konum') {
    answer = "Plajımız Kilyos'ta yer almaktadır. Seferlerimiz Hacıosman Metro (Google Maps: https://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw) ve Mecidiyeköy Vakıfbank (https://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw) önünden kalkmaktadır.";
  }

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: answer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "menu_ana", title: "Ana Menü" } }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendContactSupport(phone) {
  const data = {
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: "🎧 Yetkiliyle görüşmek ve canlı destek almak için lütfen aşağıdaki linke tıklayarak doğrudan WhatsApp üzerinden iletişime geçin:\n\n👉 https://wa.me/905309561053" }
  };
  return sendMessage(data);
}

async function sendTripSelectionList(phone, dayTitle) {
  const t = getTurkeyTime();
  const isToday = dayTitle.startsWith('Bugün');
  const currentTimeInt = t.getHours() * 100 + t.getMinutes();

  const allGidis = [
    { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00", timeInt: 800 },
    { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30", timeInt: 1030 },
    { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00", timeInt: 1200 }
  ];

  const allDonus = [
    { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00", timeInt: 1700 },
    { id: "sefer_donus_hac_1900", title: "Hacıosman 19:00", timeInt: 1900 }
  ];

  let availableGidis = allGidis;
  let availableDonus = allDonus;

  if (isToday) {
    availableGidis = allGidis.filter(trip => trip.timeInt > currentTimeInt);
    availableDonus = allDonus.filter(trip => trip.timeInt > currentTimeInt);
  }

  if (availableGidis.length === 0 && availableDonus.length === 0) {
    return sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: 'text',
      text: { body: `Üzgünüz, ${dayTitle} için tüm servislerimizin saati geçmiştir. Lütfen farklı bir gün seçmek için ana menüye dönünüz.` }
    });
  }

  const sections = [];
  if (availableGidis.length > 0) {
    sections.push({
      title: "🏖️ Gidiş Seferleri",
      rows: availableGidis.map(t => ({ id: t.id, title: t.title }))
    });
  }
  if (availableDonus.length > 0) {
    sections.push({
      title: "🌆 Dönüş Seferleri",
      rows: availableDonus.map(t => ({ id: t.id, title: t.title }))
    });
  }

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: `🚐 ${dayTitle} Günü Seferleri` },
      body: { text: "Lütfen rezervasyon yapmak istediğiniz kalkış noktası ve saati seçin:" },
      action: {
        button: "⏱️ Sefer Seçiniz",
        sections: sections
      }
    }
  };
  return sendMessage(data);
}

async function sendGroupSelectionList(phone, dayTitle, timeTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      "type": "list",
      "header": {
        "type": "text",
        "text": "👥 Lütfen Grubunuzu Seçin"
      },
      "body": {
        "text": `Seçim: ${dayTitle} - ${timeTitle}\nPlajımıza damsız giriş yapılamamaktadır. Lütfen grubunuzun yapısını ve kişi sayısını seçin:`
      },
      action: {
        button: "👥 Grup Tipi Seçin",
        sections: [
          {
            title: "Uygun Gruplar",
            rows: [
              { id: "grup_kadin_1", title: "👩 1 Kadın (1 Kişi)" },
              { id: "grup_kadin_2", title: "👩‍🦰 2 Kadın (2 Kişi)" },
              { id: "grup_kadin_3", title: "👩‍🦰 3+ Kadın Grubu" },
              { id: "grup_karma_2", title: "👫 1 Kadın 1 Erkek" },
              { id: "grup_karma_3", title: "👨‍👩‍👧‍👦 Karma (3 Kişi)" },
              { id: "grup_karma_4", title: "👨‍👩‍👧‍👦 Karma (4+ Kişi)" }
            ]
          },
          {
            title: "Uygun Olmayan Grup",
            rows: [
              { id: "grup_erkek_iptal", title: "👨 Sadece Erkek", description: "Rezervasyon kabul edilmez" }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendNameRequestMessage(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: {
      body: "Lütfen rezervasyonunuzu tamamlamak için *Adınızı ve Soyadınızı* yazarak gönderin. (Örn: Ahmet Yılmaz)"
    }
  };
  return sendMessage(data);
}

async function sendProcessingMessage(phone, dayTitle, timeTitle, countTitle, nameTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: {
      body: `⏳ Rezervasyonunuz İşleniyor!\n\n👤 *İsim:* ${nameTitle}\n📅 *Gün:* ${dayTitle}\n⏰ *Saat:* ${timeTitle}\n👥 *Grup:* ${countTitle}\n\nTalebiniz yetkiliye iletildi. Onaylandıktan sonra size konum ve bilgilendirme mesajı gönderilecektir. Bizi tercih ettiğiniz için teşekkürler!`
    }
  };
  return sendMessage(data);
}

async function sendAdminApprovalRequest(adminPhone, reservationId, phone, dayTitle, timeTitle, countTitle, nameTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: adminPhone,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        "text": "🔔 Yeni Rezervasyon Talebi!"
      },
      body: {
        text: `👤 İsim: ${nameTitle}\n📱 Müşteri: +${phone}\n📅 Gün: ${dayTitle}\n⏰ Saat: ${timeTitle}\n👥 Grup: ${countTitle}\n\nBu rezervasyonu onaylıyor musunuz?`
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: `admin_approve_${reservationId}`, title: "✅ Onayla" } },
          { type: "reply", reply: { id: `admin_reject_${reservationId}`, title: "❌ Reddet" } }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendStatusUpdateToUser(phone, status, isHaciosman) {
  let bodyText = "";
  if (status === 'Onaylandı') {
    const mapsLink = isHaciosman 
      ? "https://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw"
      : "https://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw";
      
    bodyText = `🎉 *Rezervasyonunuz Onaylandı!*\n\nServis saatinden 15 dakika önce kalkış noktasında olmanızı rica ederiz.\n\n📍 *Kalkış Noktası Konumu:*\n${mapsLink}\n\nİyi tatiller! 🌊`;
  } else {
    bodyText = '❌ *Rezervasyonunuz Reddedildi.*\n\nMaalesef seçtiğiniz saat için kontenjanımız dolmuştur veya sefer iptal edilmiştir. Lütfen bizimle iletişime geçin.';
  }
    
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: bodyText }
  };
  return sendMessage(data);
}

async function sendPdfDocument(adminPhone, filePath, fileName) {
  // Demo modunda doğrudan PDF yüklemesi simüle edilir.
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: adminPhone,
    type: "document",
    document: {
      link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 
      caption: "📅 Günlük Rezervasyon Raporu"
    }
  };
  return sendMessage(data);
}

module.exports = {
  sendMessage,
  sendWelcomeMessage,
  sendMainMenu,
  sendDaySelectionList,
  sendFaqList,
  sendFaqAnswer,
  sendContactSupport,
  sendTripSelectionList,
  sendGroupSelectionList,
  sendNameRequestMessage,
  sendProcessingMessage,
  sendAdminApprovalRequest,
  sendStatusUpdateToUser,
  sendPdfDocument
};
