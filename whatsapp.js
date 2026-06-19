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

async function sendDaySelectionList(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "📅 Seyahat Günü"
      },
      body: {
        text: "Lütfen rezervasyon yapmak istediğiniz günü seçin:"
      },
      action: {
        button: "📅 Gün Seçiniz",
        sections: [
          {
            title: "Yaklaşan Günler",
            rows: [
              { id: "bugun", title: "Bugün (Cuma)" },
              { id: "yarin", title: "Yarın (Cumartesi)" },
              { id: "pazartesi", title: "Pazartesi" },
              { id: "sali", title: "Salı" }
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

async function sendFaqAnswer(phone, questionId) {
  let answer = "";
  if (questionId === "faq_iptal") answer = "Rezervasyon iptalleri sefer saatinden en geç 12 saat önce yapılmalıdır. Aksi takdirde ücret iadesi yapılmaz.";
  else if (questionId === "faq_evcil") answer = "Plajımıza küçük ırk evcil dostlarımızı tasmalı olmak şartıyla kabul ediyoruz.";
  else if (questionId === "faq_yemek") answer = "Plaj alanına dışarıdan yiyecek ve içecek getirilmesi yasaktır.";
  else if (questionId === "faq_konum") answer = "Plajımız Kilyos'ta bulunmaktadır. Konum: https://maps.app.goo.gl/ornek";
  
  answer += "\n\nAna menüye dönmek için 'Merhaba' yazabilirsiniz.";

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: answer }
  };
  return sendMessage(data);
}

async function sendContactSupport(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: "🎧 Yetkiliyle görüşmek ve canlı destek almak için lütfen aşağıdaki linke tıklayarak doğrudan WhatsApp üzerinden iletişime geçin:\n\n👉 https://wa.me/905309561053" }
  };
  return sendMessage(data);
}

async function sendTripSelectionList(phone, dayTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: `🚐 ${dayTitle} Günü Seferleri`
      },
      body: {
        text: "Lütfen rezervasyon yapmak istediğiniz kalkış noktası ve saati seçin:"
      },
      action: {
        button: "⏱️ Sefer Seçiniz",
        sections: [
          {
            title: "🏖️ Gidiş Seferleri",
            rows: [
              { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00" },
              { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30" },
              { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00" }
            ]
          },
          {
            title: "🌆 Dönüş Seferleri",
            rows: [
              { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00" },
              { id: "sefer_donus_hac_1900", title: "Hacıosman 19:00" }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendPassengerCountList(phone, dayTitle, timeTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      "type": "list",
      "header": {
        "type": "text",
        "text": "👥 Harika! Peki kaç kişi olacaksınız?"
      },
      "body": {
        "text": `Seçim: ${dayTitle} - ${timeTitle}\nLütfen listeden kişi sayısını seçin.`
      },
      action: {
        button: "👥 Kişi Sayısı Seçin",
        sections: [
          {
            title: "Kişi Sayısı",
            rows: [
              { id: "kisi_1", title: "1 Kişi" },
              { id: "kisi_2", title: "2 Kişi" },
              { id: "kisi_3", title: "3 Kişi" },
              { id: "kisi_4", title: "4 Kişi" },
              { id: "kisi_5", title: "5 Kişi" },
              { id: "kisi_6", title: "6+ Kişi" }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}

async function sendProcessingMessage(phone, dayTitle, timeTitle, countTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: {
      body: `⏳ Rezervasyonunuz İşleniyor!\n\n📅 *Gün:* ${dayTitle}\n⏰ *Saat:* ${timeTitle}\n👥 *Kişi:* ${countTitle}\n\nTalebiniz yetkiliye iletildi. Onaylandıktan sonra size bilgilendirme mesajı gönderilecektir. Bizi tercih ettiğiniz için teşekkürler!`
    }
  };
  return sendMessage(data);
}

async function sendAdminApprovalRequest(adminPhone, reservationId, phone, dayTitle, timeTitle, countTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: adminPhone,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "🔔 Yeni Rezervasyon Talebi!"
      },
      body: {
        text: `Müşteri: +${phone}\nGün: ${dayTitle}\nSaat: ${timeTitle}\nKişi Sayısı: ${countTitle}\n\nBu rezervasyonu onaylıyor musunuz?`
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

async function sendStatusUpdateToUser(phone, status) {
  const bodyText = status === 'Onaylandı' 
    ? '🎉 *Rezervasyonunuz Onaylandı!*\n\nServis saatinden 15 dakika önce kalkış noktasında olmanızı rica ederiz. İyi tatiller! 🌊'
    : '❌ *Rezervasyonunuz Reddedildi.*\n\nMaalesef seçtiğiniz saat için kontenjanımız dolmuştur veya sefer iptal edilmiştir. Lütfen bizimle iletişime geçin.';
    
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
  sendWelcomeMessage,
  sendMainMenu,
  sendDaySelectionList,
  sendFaqList,
  sendFaqAnswer,
  sendContactSupport,
  sendTripSelectionList,
  sendPassengerCountList,
  sendProcessingMessage,
  sendAdminApprovalRequest,
  sendStatusUpdateToUser,
  sendPdfDocument
};
