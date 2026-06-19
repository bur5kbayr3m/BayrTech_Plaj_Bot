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

async function sendLanguageSelection(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Lütfen dil seçin / Please select your language:" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "lang_tr", title: "🇹🇷 Türkçe" } },
          { type: "reply", reply: { id: "lang_en", title: "🇬🇧 English" } }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendWelcomeMessage(phone, lang = 'tr') {
  const welcomeText = lang === 'en' 
    ? `HELLO 🌴

⚠️ Entry without a female companion is not allowed.

🚐 SHUTTLE (ONE WAY):
Hacıosman: 300₺
Mecidiyeköy: 350₺

For reservation:
Just write: Stop – Number of People – Time – Name.
Reservations are taken 1 day in advance.

🏖️ BEACH ENTRANCE FEE
Weekday: 800₺
Weekend: 1200₺

(Sunbed, umbrella, parking, shower and WC included.)
0-6 years free
7-12 years: half price

❗️Please send your details after this message.`
    : `MERHABA 🌴

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

async function sendMainMenu(phone, lang = 'tr') {
  const headerText = "🏖️ GOGA BEACH PLAJ SHUTTLE";
  const bodyText = lang === 'en' ? "How can I help you? Please select an option from the menu:" : "Size nasıl yardımcı olabilirim? Lütfen menüden bir işlem seçin:";
  const buttonText = lang === 'en' ? "Open Menu" : "Menüyü Aç";
  const sectionTitle = lang === 'en' ? "Options" : "İşlemler";
  const rezTitle = lang === 'en' ? "📅 Make Reservation" : "📅 Rezervasyon Yap";
  const faqTitle = lang === 'en' ? "❓ FAQ" : "❓ Sıkça Sorulan Sorular";
  const supportTitle = lang === 'en' ? "🎧 Live Support" : "🎧 Canlı Destek";

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: [
          {
            title: sectionTitle,
            rows: [
              { id: "menu_rezervasyon", title: rezTitle },
              { id: "menu_sss", title: faqTitle },
              { id: "menu_canli_destek", title: supportTitle }
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
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function sendDaySelectionList(phone, lang = 'tr') {
  const t = getTurkeyTime();
  const days = lang === 'en' ? EN_DAYS : TR_DAYS;
  const todayTitle = lang === 'en' ? "Today" : "Bugün";
  const tomorrowTitle = lang === 'en' ? "Tomorrow" : "Yarın";
  
  const d0 = days[t.getDay()];
  const d1 = days[(t.getDay() + 1) % 7];
  const d2 = days[(t.getDay() + 2) % 7];

  const headerText = lang === 'en' ? "📅 Reservation Day" : "📅 Rezervasyon Günü";
  const bodyText = lang === 'en' ? "Please select the day you want to book:" : "Lütfen rezervasyon yapmak istediğiniz günü seçin:";
  const buttonText = lang === 'en' ? "Select Day" : "Gün Seçin";
  const sectionTitle = lang === 'en' ? "Upcoming Days" : "Önümüzdeki Günler";

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: [
          {
            title: sectionTitle,
            rows: [
              { id: "day_bugun", title: `${todayTitle} (${d0})` },
              { id: "day_yarin", title: `${tomorrowTitle} (${d1})` },
              { id: "day_gun3", title: d2 }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendFaqList(phone, lang = 'tr') {
  const headerText = lang === 'en' ? "❓ FAQ" : "❓ Sıkça Sorulan Sorular";
  const bodyText = lang === 'en' ? "Select a question to see the answer:" : "Cevabını öğrenmek istediğiniz soruyu seçin:";
  const buttonText = lang === 'en' ? "Questions" : "Sorular";
  const sectionTitle = lang === 'en' ? "FAQ" : "Sıkça Sorulan Sorular";

  const rows = lang === 'en' ? [
    { id: "faq_iptal", title: "Cancellation Policy?" },
    { id: "faq_shuttle", title: "Is the shuttle paid?" },
    { id: "faq_yemek", title: "Outside Food/Drink?" },
    { id: "faq_konum", title: "Location Information" }
  ] : [
    { id: "faq_iptal", title: "İptal Şartları Neler?" },
    { id: "faq_shuttle", title: "Servis ücretli mi?" },
    { id: "faq_yemek", title: "Yiyecek ve İçecek" },
    { id: "faq_konum", title: "Konum Bilgisi" }
  ];

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: [
          { title: sectionTitle, rows: rows }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendFaqAnswer(phone, faqId, lang = 'tr') {
  let answer = "";
  if (faqId === 'faq_iptal') {
    answer = lang === 'en' 
      ? "Cancellations must be made at least 1 day in advance." 
      : "İptal işlemleri için en geç 1 gün öncesinden haber vermeniz gerekmektedir.";
  } else if (faqId === 'faq_shuttle') {
    answer = lang === 'en' 
      ? "Yes, our shuttle service is 300₺ from Hacıosman and 350₺ from Mecidiyeköy (One Way)." 
      : "Evet, servis ücretimiz tek yön Hacıosman 300₺, Mecidiyeköy 350₺'dir.";
  } else if (faqId === 'faq_yemek') {
    answer = lang === 'en' 
      ? "We have various concept points such as restaurants, cafes, bars, and coffee shops serving our guests at our facility. Therefore, we kindly ask you not to bring food and drinks from outside." 
      : "Tesisimizde misafirlerimize hizmet veren restoran, kafe, bar, kafeterya ve kahveci gibi çeşitli konsept noktalarımız bulunmaktadır. Bu nedenle dışarıdan yiyecek ve içecek getirilmemesini rica ederiz.";
  } else if (faqId === 'faq_konum') {
    answer = lang === 'en' 
      ? `Our beach is located in Kilyos. Shuttles depart from:\n\n📍 Hacıosman Metro:\nhttps://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw\n\n📍 Mecidiyeköy Vakıfbank:\nhttps://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw` 
      : `Plajımız Kilyos'ta yer almaktadır. Seferlerimiz aşağıdaki noktalardan kalkmaktadır:\n\n📍 Hacıosman Metro:\nhttps://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw\n\n📍 Mecidiyeköy Vakıfbank:\nhttps://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw`;
  }

  const menuTitle = lang === 'en' ? "Main Menu" : "Ana Menü";

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
          { type: "reply", reply: { id: "menu_ana", title: menuTitle } }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendContactSupport(phone, lang = 'tr') {
  const bodyText = lang === 'en' 
    ? `🎧 To speak with a representative and get live support, please click the link below to contact us directly via WhatsApp:

👉 https://wa.me/905309561053`
    : `🎧 Yetkiliyle görüşmek ve canlı destek almak için lütfen aşağıdaki linke tıklayarak doğrudan WhatsApp üzerinden iletişime geçin:

👉 https://wa.me/905309561053`;

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: bodyText }
  };
  return sendMessage(data);
}

async function sendTripSelectionList(phone, dayTitle, lang = 'tr') {
  const t = getTurkeyTime();
  const isToday = dayTitle.startsWith('Bugün') || dayTitle.startsWith('Today');
  const currentTimeInt = t.getHours() * 100 + t.getMinutes();

  let allGidis = [];
  let allDonus = [];
  
  if (dayTitle.includes('Cumartesi') || dayTitle.includes('Saturday')) {
    allGidis = [
      { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00", timeInt: 800 },
      { id: "sefer_gidis_hac_0830", title: "Hacıosman 08:30", timeInt: 830 },
      { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30", timeInt: 1030 },
      { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00", timeInt: 1200 }
    ];
    allDonus = [
      { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00", timeInt: 1700 },
      { id: "sefer_donus_hac_1830", title: "Hacıosman 18:30", timeInt: 1830 },
      { id: "sefer_donus_hac_1930", title: "Hacıosman 19:30", timeInt: 1930 }
    ];
  } else {
    allGidis = [
      { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00", timeInt: 800 },
      { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30", timeInt: 1030 },
      { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00", timeInt: 1200 }
    ];
    allDonus = [
      { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00", timeInt: 1700 },
      { id: "sefer_donus_hac_1900", title: "Hacıosman 19:00", timeInt: 1900 }
    ];
  }

  let availableGidis = allGidis;
  let availableDonus = allDonus;

  if (isToday) {
    availableGidis = allGidis.filter(trip => trip.timeInt > currentTimeInt);
    availableDonus = allDonus.filter(trip => trip.timeInt > currentTimeInt);
  }

  if (availableGidis.length === 0 && availableDonus.length === 0) {
    const errorMsg = lang === 'en' 
      ? `Sorry, all our shuttles for ${dayTitle} have passed. Please return to the main menu to select another day.`
      : `Üzgünüz, ${dayTitle} için tüm servislerimizin saati geçmiştir. Lütfen farklı bir gün seçmek için ana menüye dönünüz.`;
    return sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: 'text',
      text: { body: errorMsg }
    });
  }

  const sections = [];
  if (availableGidis.length > 0) {
    sections.push({
      title: lang === 'en' ? "🏖️ Departures" : "🏖️ Gidiş Seferleri",
      rows: availableGidis.map(t => ({ id: t.id, title: t.title }))
    });
  }
  if (availableDonus.length > 0) {
    sections.push({
      title: lang === 'en' ? "🌆 Returns" : "🌆 Dönüş Seferleri",
      rows: availableDonus.map(t => ({ id: t.id, title: t.title }))
    });
  }

  const headerText = lang === 'en' ? `🚐 ${dayTitle} Shuttles` : `🚐 ${dayTitle} Günü Seferleri`;
  const bodyText = lang === 'en' ? "Please select your departure point and time:" : "Lütfen rezervasyon yapmak istediğiniz kalkış noktası ve saati seçin:";
  const buttonText = lang === 'en' ? "⏱️ Select Time" : "⏱️ Sefer Seçiniz";

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: sections
      }
    }
  };
  return sendMessage(data);
}

async function sendGroupSelectionList(phone, dayTitle, timeTitle, lang = 'tr') {
  const headerText = lang === 'en' ? "👥 Select Your Group" : "👥 Lütfen Grubunuzu Seçin";
  const bodyText = lang === 'en' 
    ? `Selection: ${dayTitle} - ${timeTitle}
Entry without female companion is not allowed. Please select your group structure:`
    : `Seçim: ${dayTitle} - ${timeTitle}
Plajımıza damsız giriş yapılamamaktadır. Lütfen grubunuzun yapısını ve kişi sayısını seçin:`;
  
  const btnText = lang === 'en' ? "👥 Select Group Type" : "👥 Grup Tipi Seçin";
  const validGroupsTitle = lang === 'en' ? "Valid Groups" : "Uygun Gruplar";
  const invalidGroupTitle = lang === 'en' ? "Invalid Group" : "Uygun Olmayan Grup";

  const rows = lang === 'en' ? [
    { id: "grup_kadin_1", title: "👩 1 Woman (1 Person)" },
    { id: "grup_kadin_2", title: "👩‍🦰 2 Women (2 Ppl)" },
    { id: "grup_kadin_3", title: "👩‍🦰 3+ Women Group" },
    { id: "grup_karma_2", title: "👫 1 W / 1 M" },
    { id: "grup_karma_3", title: "👨‍👩‍👧‍👦 Mixed (3 Ppl)" },
    { id: "grup_karma_4", title: "👨‍👩‍👧‍👦 Mixed (4+ Ppl)" }
  ] : [
    { id: "grup_kadin_1", title: "👩 1 Kadın (1 Kişi)" },
    { id: "grup_kadin_2", title: "👩‍🦰 2 Kadın (2 Kişi)" },
    { id: "grup_kadin_3", title: "👩‍🦰 3+ Kadın Grubu" },
    { id: "grup_karma_2", title: "👫 1 Kadın 1 Erkek" },
    { id: "grup_karma_3", title: "👨‍👩‍👧‍👦 Karma (3 Kişi)" },
    { id: "grup_karma_4", title: "👨‍👩‍👧‍👦 Karma (4+ Kişi)" }
  ];

  const invalidRows = lang === 'en' ? [
    { id: "grup_erkek_iptal", title: "👨 Only Men", description: "Not allowed" }
  ] : [
    { id: "grup_erkek_iptal", title: "👨 Sadece Erkek", description: "Rezervasyon kabul edilmez" }
  ];

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        button: btnText,
        sections: [
          { title: validGroupsTitle, rows: rows },
          { title: invalidGroupTitle, rows: invalidRows }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendNameRequestMessage(phone, lang = 'tr') {
  const bodyText = lang === 'en'
    ? "Please write and send your *First and Last Name* to complete the reservation. (e.g. John Doe)"
    : "Lütfen rezervasyonunuzu tamamlamak için *Adınızı ve Soyadınızı* yazarak gönderin. (Örn: Ahmet Yılmaz)";
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: bodyText }
  };
  return sendMessage(data);
}

async function sendProcessingMessage(phone, dayTitle, timeTitle, countTitle, nameTitle, lang = 'tr') {
  const bodyText = lang === 'en'
    ? `⏳ Your Reservation is Processing!

👤 *Name:* ${nameTitle}
📅 *Day:* ${dayTitle}
⏰ *Time:* ${timeTitle}
👥 *Group:* ${countTitle}

Your request has been forwarded to the admin. You will receive a confirmation and location message once approved. Thank you for choosing us!`
    : `⏳ Rezervasyonunuz İşleniyor!

👤 *İsim:* ${nameTitle}
📅 *Gün:* ${dayTitle}
⏰ *Saat:* ${timeTitle}
👥 *Grup:* ${countTitle}

Talebiniz yetkiliye iletildi. Onaylandıktan sonra size konum ve bilgilendirme mesajı gönderilecektir. Bizi tercih ettiğiniz için teşekkürler!`;

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: bodyText }
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
      header: { type: "text", text: "🔔 Yeni Rezervasyon Talebi!" },
      body: { text: `👤 İsim: ${nameTitle}
📱 Müşteri: +${phone}
📅 Gün: ${dayTitle}
⏰ Saat: ${timeTitle}
👥 Grup: ${countTitle}

Bu rezervasyonu onaylıyor musunuz?` },
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

async function sendStatusUpdateToUser(phone, status, isHaciosman, lang = 'tr') {
  let bodyText = "";
  const mapsLink = isHaciosman 
      ? "https://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw"
      : "https://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw";
  const durak = isHaciosman ? "Hacıosman Metro" : "Mecidiyeköy";

  if (status === 'Onaylandı') {
    bodyText = lang === 'en'
      ? `🎉 *Your Reservation is Confirmed!*

Selected Stop: *${durak}*

Please be at the departure point 15 minutes before the shuttle time.

📍 *Departure Point Location:*
${mapsLink}

Have a great holiday and stay healthy! 🌊`
      : `🎉 *Rezervasyonunuz Onaylandı!*

Seçtiğiniz Durak: *${durak}*

Servis saatinden 15 dakika önce kalkış noktasında olmanızı rica ederiz.

📍 *Kalkış Noktası Konumu:*
${mapsLink}

İyi tatiller, sağlıklı günler dileriz! 🌊`;
  } else {
    bodyText = lang === 'en'
      ? `❌ *Your Reservation is Rejected.*

Unfortunately, our quota for your selected time is full or the shuttle was cancelled. Please contact us for details.`
      : `❌ *Rezervasyonunuz Reddedildi.*

Maalesef seçtiğiniz saat için kontenjanımız dolmuştur veya sefer iptal edilmiştir. Lütfen bizimle iletişime geçin.`;
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


async function sendCancelRequestToAdmin(adminPhone, reservationId, customerPhone, resDetails) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: adminPhone,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "🚨 İptal Talebi!" },
      body: { text: `Müşteri (+${customerPhone}) rezervasyonunu İPTAL etmek istiyor.\n\n👤 İsim: ${resDetails.ad_soyad}\n📍 Konum: ${resDetails.lokasyon_adi}\n👥 Kişi: ${resDetails.kisi_sayisi}\n\nİptali onaylıyor musunuz?` },
      action: {
        buttons: [
          { type: "reply", reply: { id: `admin_cancel_app_${reservationId}`, title: "✅ İptali Onayla" } },
          { type: "reply", reply: { id: `admin_cancel_rej_${reservationId}`, title: "❌ İptal Etme" } }
        ]
      }
    }
  };
  return sendMessage(data);
}

module.exports = {
  sendMessage,
  sendLanguageSelection,
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
  sendPdfDocument,
  sendCancelRequestToAdmin
};
