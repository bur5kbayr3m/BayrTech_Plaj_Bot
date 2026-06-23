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

const { getSetting } = require('./settingsManager');

async function sendWelcomeMessage(phone, lang = 'tr') {
  const welcomeText = lang === 'en' 
    ? getSetting('welcome_text_en')
    : getSetting('welcome_text_tr');

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
  let bodyText = lang === 'en' ? "Please select the day you want to book:" : "Lütfen rezervasyon yapmak istediğiniz günü seçin:";
  bodyText += `\n\nNot: Dönüşte rezervasyon yoktur. Kalkıştan 10-15 dk önce araca doğrudan binebilirsiniz. Dönüş servislerimiz SADECE Hacıosman Metro'ya yapılmaktadır.`;
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
    { id: "faq_ucret", title: "Is the shuttle paid?" },
    { id: "faq_yemek", title: "Outside Food/Drink?" },
    { id: "faq_konum", title: "Location Information" },
    { id: "faq_saat", title: "Where is the shuttle?" }
  ] : [
    { id: "faq_ucret", title: "Servis Ücretli mi?" },
    { id: "faq_yemek", title: "Yiyecek ve İçecek" },
    { id: "faq_konum", title: "Konum Bilgisi" },
    { id: "faq_saat", title: "Servis aracı nerede?" }
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
  if (faqId === 'faq_ucret') {
    answer = lang === 'en' 
      ? getSetting('faq_ucret_en')
      : getSetting('faq_ucret_tr');
  } else if (faqId === 'faq_yemek') {
    answer = lang === 'en' 
      ? getSetting('faq_yemek_en')
      : getSetting('faq_yemek_tr');
  } else if (faqId === 'faq_konum') {
    return getSetting('faq_konum_tr');
  } else if (faqId === 'faq_saat') {
    answer = lang === 'en' 
      ? getSetting('faq_saat_en')
      : getSetting('faq_saat_tr');
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
  
  const isWeekend = dayTitle.includes('Cumartesi') || dayTitle.includes('Saturday') || dayTitle.includes('Pazar') || dayTitle.includes('Sunday');
  const dayType = isWeekend ? 'Haftasonu' : 'Haftaici';
  
  // Fetch dynamic templates from Supabase
  const { getTripTemplates } = require('./supabase');
  const templates = await getTripTemplates(dayType);
  
  // Map templates to interactive list format
  templates.forEach(tmp => {
    // Convert "08:30" to 830 integer for comparison
    const timeParts = tmp.saat.split(':');
    const timeInt = parseInt(timeParts[0]) * 100 + parseInt(timeParts[1]);
    
    // Create emoji prefix
    let emoji = "📍";
    if (tmp.kalkis_yeri.includes('Mecidiyeköy') || tmp.kalkis_yeri.includes('Mcd')) emoji = "🟣";
    else if (tmp.kalkis_yeri.includes('Hacıosman') || tmp.kalkis_yeri.includes('Hac')) emoji = "🟢";
    else if (tmp.kalkis_yeri.includes('Plaj')) emoji = "🏖️";
    
    // Format Title
    let displayKalkis = tmp.kalkis_yeri;
    if (tmp.yon === 'Donus') displayKalkis = "Dönüş"; // Since return is always from Beach, just show "Dönüş 17:00"
    
    const title = `${emoji} ${displayKalkis} ${tmp.saat}`;
    const id = `sefer_${tmp.id}`;
    
    if (tmp.yon === 'Gidis') {
      allGidis.push({ id, title, timeInt });
    } else {
      allDonus.push({ id, title, timeInt });
    }
  });

  let availableGidis = allGidis;
  let availableDonus = allDonus;

  if (isToday) {
    availableGidis = allGidis.filter(trip => trip.timeInt > currentTimeInt);
    // Donus is NOT filtered by time. Always show return info for the day.
  }

  if (availableGidis.length === 0) {
    const errorMsg = lang === 'en' 
      ? `Sorry, all our departure shuttles for ${dayTitle} have passed. Please return to the main menu to select another day.`
      : `Üzgünüz, ${dayTitle} için tüm gidiş servislerimizin saati geçmiştir. Lütfen farklı bir gün seçmek için ana menüye dönünüz.`;
    return sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: 'text',
      text: { body: errorMsg }
    });
  }

  const sections = [];
  sections.push({
    title: lang === 'en' ? "🏖️ Departures" : "🏖️ Gidiş Seferleri",
    rows: availableGidis.map(t => ({ id: t.id, title: t.title }))
  });

  let donusText = lang === 'en' 
    ? "\n\n🌆 *Return Shuttles (Info Only):*\n" 
    : "\n\n🌆 *Dönüş Sefer Saatleri (Sadece Bilgi):*\n";
  if (availableDonus.length > 0) {
    donusText += availableDonus.map(t => "• " + t.title).join("\n");
    donusText += "\n" + (lang === 'en' ? getSetting('donus_info_en') : getSetting('donus_info_tr'));
  } else {
    donusText += lang === 'en' ? "No return shuttles available." : "Uygun dönüş seferi bulunmamaktadır.";
  }

  const headerText = lang === 'en' ? `🚐 ${dayTitle} Shuttles` : `🚐 ${dayTitle} Günü Seferleri`;
  const bodyText = (lang === 'en' ? "Please select your departure point and time:" : "Lütfen rezervasyon yapmak istediğiniz kalkış noktası ve saati seçin (Sadece gidiş seferleri rezerve edilebilir):") + donusText;
  const buttonText = lang === 'en' ? "⏱️ Select Departure" : "⏱️ Gidiş Seçiniz";

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
    { id: "grup_karma_3", title: "👨‍👩‍👧‍👦 Mixed (3 Ppl)" }
  ] : [
    { id: "grup_kadin_1", title: "👩 1 Kadın (1 Kişi)" },
    { id: "grup_kadin_2", title: "👩‍🦰 2 Kadın (2 Kişi)" },
    { id: "grup_kadin_3", title: "👩‍🦰 3+ Kadın Grubu" },
    { id: "grup_karma_2", title: "👫 1 Kadın 1 Erkek" },
    { id: "grup_karma_3", title: "👨‍👩‍👧‍👦 Karma (3 Kişi)" }
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
          { type: "reply", reply: { id: `admin_reject_${reservationId}`, title: "❌ Reddet" } },
          { type: "reply", reply: { id: `admin_full_${reservationId}`, title: "⚠️ Dolu (Yönlendir)" } }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendStatusUpdateToUser(phone, status, isHaciosman, lang = 'tr', updatedRes = null) {
  let bodyText = "";
  const mapsLink = isHaciosman 
      ? "https://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw"
      : "https://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw";
  const durak = isHaciosman ? "Hacıosman Metro" : "Mecidiyeköy Vakıfbank Önü";

  let detailsText = "";
  if (updatedRes) {
    const saat = updatedRes.trips && updatedRes.trips.saat ? updatedRes.trips.saat.substring(0, 5) : "";
    const tarih = updatedRes.trips && updatedRes.trips.tarih ? updatedRes.trips.tarih : "";
    
    detailsText = lang === 'en'
      ? `\n👤 *Name:* ${updatedRes.ad_soyad}\n👥 *Passengers:* ${updatedRes.kisi_sayisi}\n📅 *Date:* ${tarih}\n⏱️ *Time:* ${saat}\n`
      : `\n👤 *İsim:* ${updatedRes.ad_soyad}\n👥 *Kişi Sayısı:* ${updatedRes.kisi_sayisi}\n📅 *Tarih:* ${tarih}\n⏱️ *Saat:* ${saat}\n`;
  }

  if (status === 'Onaylandı') {
    bodyText = lang === 'en'
      ? `🎉 *Your Reservation is Confirmed!*\n${detailsText}
Selected Stop: *${durak}*

Please be at the departure point 15 minutes before the shuttle time.

📍 *Departure Point Location:*
${mapsLink}

Have a great holiday and stay healthy! 🌊`
      : `🎉 *Rezervasyonunuz Onaylandı!*\n\nSeçtiğiniz Durak: *${durak}*\n\nServis saatinden 15 dakika önce kalkış noktasında olmanızı rica ederiz.\n\n📍 *Kalkış Noktası Konumu:*\n${mapsLink}\n\nİyi tatiller, sağlıklı günler dileriz! 🌊`;
  } else {
    bodyText = lang === 'en'
      ? `❌ *Your Reservation is Rejected.*
${detailsText}
Unfortunately, our quota for your selected time is full or the shuttle was cancelled. Please contact us for details.`
      : `❌ *Rezervasyonunuz Reddedildi.*
${detailsText}
Maalesef seçtiğiniz saat için kontenjanımız dolmuştur veya sefer iptal edilmiştir. Lütfen bizimle iletişime geçin.`;
  }
  
  if (status === 'Onaylandı') {
    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: `cancel_req`, title: lang === 'en' ? "❌ Cancel Request" : "❌ İptal Talebi" } },
            { type: "reply", reply: { id: `menu_sss`, title: lang === 'en' ? "❓ FAQ" : "❓ SSS" } },
            { type: "reply", reply: { id: `menu_canli_destek`, title: lang === 'en' ? "📞 Support" : "📞 Canlı Destek" } }
          ]
        }
      }
    };
    return sendMessage(data);
  } else if (status === 'Dolu') {
    bodyText = lang === 'en'
      ? `❌ *Reservation Failed*\n\nUnfortunately, the shuttle you selected has reached its maximum capacity. Please select a different time.`
      : `❌ *Rezervasyon Başarısız*\n\nMaalesef seçtiğiniz saatin kontenjanı dolmuştur. Lütfen farklı bir saat seçerek rezervasyonunuzu tekrar oluşturun.`;
      
    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: `menu_ana`, title: lang === 'en' ? "🏠 Main Menu" : "🏠 Ana Menü" } },
            { type: "reply", reply: { id: `menu_rezervasyon`, title: lang === 'en' ? "📅 Make Reservation" : "📅 Rezervasyon Yap" } }
          ]
        }
      }
    };
    return sendMessage(data);
  } else {
    // Reddedildi
    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: `menu_canli_destek`, title: lang === 'en' ? "📞 Live Support" : "📞 Canlı Destek" } },
            { type: "reply", reply: { id: `menu_rezervasyon`, title: lang === 'en' ? "📅 Make Reservation" : "📅 Rezervasyon Yap" } }
          ]
        }
      }
    };
    return sendMessage(data);
  }
}
async function sendPdfDocument(adminPhone, fileUrl, fileName) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: adminPhone,
    type: "document",
    document: {
      link: fileUrl, 
      filename: fileName,
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
