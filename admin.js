const { sendMessage } = require('./whatsapp');
const { updateSession, resetSession } = require('./state');
const { addTripTemplate, removeTripTemplate, removeTripTemplateById, getTripTemplates } = require('./supabase');

function getTurkeyTime() {
  const d = new Date();
  return new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
}

async function sendAdminMainMenu(phone) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: 'interactive',
    interactive: {
      type: "list",
      header: { type: "text", text: "⚙️ ADMİN PANELİ" },
      body: { text: "Sistemi yönetmek için aşağıdaki menüden işlem seçebilirsiniz.\n\n_Yeni sefer ekleyebilir, silebilir, seferleri görebilir veya bot ayarlarını güncelleyebilirsiniz._" },
      action: {
        button: "İşlem Seç",
        sections: [
          {
            title: "Sefer İşlemleri",
            rows: [
              { id: "admin_saat_ekle", title: "➕ Sefer Ekle" },
              { id: "admin_saat_sil", title: "➖ Sefer Sil" },
              { id: "admin_list_trips", title: "📋 Seferleri Gör" }
            ]
          },
          {
            title: "Sistem Ayarları",
            rows: [
              { id: "admin_settings", title: "⚙️ Ayarları Değiştir" }
            ]
          }
        ]
      }
    }
  };
  updateSession(phone, { admin_step: 1 });
  return sendMessage(data);
}

async function handleAdminFlow(phone, message, session) {
  // Check if it's a cancellation
  const isButtonCancel = message.type === 'interactive' && message.interactive.button_reply && message.interactive.button_reply.id === 'admin_iptal';
  const textBody = message.type === 'text' ? message.text.body.trim().replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase() : '';
  const isTextCancel = message.type === 'text' && (textBody === 'iptal' || textBody === 'çıkış');
  
  if (isButtonCancel || isTextCancel) {
    resetSession(phone);
    const { sendMainMenu } = require('./whatsapp');
    await sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "❌ İşlem iptal edildi. Ana menüye yönlendiriliyorsunuz." } });
    return sendMainMenu(phone);
  }

  // Step 1: Main Menu Selection
  if (session.admin_step === 1 && message.type === 'interactive') {
    const action = message.interactive.button_reply ? message.interactive.button_reply.id : (message.interactive.list_reply ? message.interactive.list_reply.id : null);
    
    if (action === 'admin_list_trips') {
      try {
        // Calling getTripTemplates without arguments returns ALL trips
        const templates = await getTripTemplates();
        if (templates.length === 0) {
          return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Sistemde hiç sefer bulunmamaktadır." } });
        }
        
        let msg = "📋 *TÜM SEFERLER*\n\n";
        const groups = { "Haftaici": [], "Haftasonu": [], "Hergün": [] };
        
        templates.forEach(t => {
          if (groups[t.gun_tipi]) {
            groups[t.gun_tipi].push(`• ${t.saat} - ${t.kalkis_yeri} (${t.yon})`);
          }
        });
        
        ['Hergün', 'Haftaici', 'Haftasonu'].forEach(g => {
          if (groups[g].length > 0) {
            msg += `📅 *${g.toUpperCase()}*\n`;
            msg += groups[g].join("\n");
            msg += "\n\n";
          }
        });
        
        await sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: msg } });
        return sendAdminMainMenu(phone);
      } catch (err) {
        console.error(err);
        return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Seferler alınırken hata oluştu." } });
      }
    }
    
    if (action === 'admin_settings') {
      updateSession(phone, { admin_step: 10, admin_action: 'settings' });
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "⚙️ BOT AYARLARI" },
          body: { text: "Değiştirmek istediğiniz metni seçin:" },
          action: {
            button: "Ayar Seçin",
            sections: [
              {
                title: "Karşılama ve İletişim",
                rows: [
                  { id: "set_welcome_text_tr", title: "Karşılama Mesajı" },
                  { id: "set_contact_phone", title: "İletişim Numarası" },
                  { id: "set_donus_info_tr", title: "Dönüş Bilgi Notu" }
                ]
              },
              {
                title: "Sıkça Sorulan Sorular",
                rows: [
                  { id: "set_faq_iptal_tr", title: "SSS: İptal Şartları" },
                  { id: "set_faq_shuttle_tr", title: "SSS: Servis Ücretli mi" },
                  { id: "set_faq_yemek_tr", title: "SSS: Yiyecek İçecek" },
                  { id: "set_faq_konum_tr", title: "SSS: Konum Bilgisi" },
                  { id: "set_faq_saat_tr", title: "SSS: Servis Nerede" }
                ]
              }
            ]
          }
        }
      });
    }
    
    if (action === 'admin_saat_sil') {
      updateSession(phone, { admin_step: 98, admin_action: 'delete' });
      // Ask Gun Tipi for Deletion
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "📅 Hangi günün seferini SİLMEK istiyorsunuz?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "del_gun_haftasonu", title: "Haftasonu" } },
              { type: "reply", reply: { id: "del_gun_haftaici", title: "Haftaiçi" } },
              { type: "reply", reply: { id: "del_gun_hergun", title: "Hergün" } }
            ]
          }
        }
      });
    }

    if (action === 'admin_saat_ekle') {
      updateSession(phone, { admin_step: 2, admin_action: 'add' });
      // Ask Gun Tipi
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "📅 Hangi gün tipi için saat ekliyorsunuz?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "add_gun_haftasonu", title: "Haftasonu" } },
              { type: "reply", reply: { id: "add_gun_haftaici", title: "Haftaiçi" } },
              { type: "reply", reply: { id: "add_gun_hergun", title: "Hergün" } }
            ]
          }
        }
      });
    }
  }

  // Deletion Step 1: Day Type Selected -> Show Trips
  if (session.admin_step === 98 && message.type === 'interactive' && message.interactive.button_reply) {
    const gunId = message.interactive.button_reply.id.replace('del_gun_', '');
    const gun = gunId === 'haftaici' ? 'Haftaici' : (gunId === 'haftasonu' ? 'Haftasonu' : 'Hergün');
    
    const templates = await getTripTemplates();
    const filtered = templates.filter(t => t.gun_tipi === gun);
    
    if (filtered.length === 0) {
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: `Sistemde ${gun} için kayıtlı sefer bulunmuyor.` } });
    }
    
    const rows = filtered.slice(0, 30).map(t => ({
      id: `del_tmp_${t.id}`,
      title: `${t.saat} ${t.kalkis_yeri}`,
      description: `${t.gun_tipi} - ${t.yon}`
    }));
    
    updateSession(phone, { admin_step: 99 });
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: `🗑️ ${gun} Seferleri` },
        body: { text: "Aşağıdaki listeden silmek istediğiniz saati seçin:" },
        action: { button: "Seç", sections: [{ title: "Kayıtlı Saatler", rows: rows }] }
      }
    });
  }

  // Deletion Step 2: Trip Selected -> Delete
  if (session.admin_step === 99 && message.type === 'interactive' && message.interactive.list_reply) {
    const replyId = message.interactive.list_reply.id; // e.g. "del_tmp_123"
    const tripId = parseInt(replyId.replace('del_tmp_', ''));
    const title = message.interactive.list_reply.title; // e.g. "08:30 Haciosman Metro"
    
    try {
      await removeTripTemplateById(tripId);
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: `✅ ${title} menüden başarıyla SİLİNDİ.` } });
    } catch (e) {
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "❌ Silme işlemi başarısız oldu." } });
    }
  }

  // Step 2: Gun Tipi Selected -> Ask Yon
  if (session.admin_step === 2 && message.type === 'interactive') {
    const gunId = message.interactive.button_reply.id;
    let gun = "Haftasonu";
    if (gunId.includes('haftaici')) gun = "Haftaici";
    if (gunId.includes('hergun')) gun = "Hergün";
    
    updateSession(phone, { admin_step: 3, admin_gun: gun });
    
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Yönü seçin:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "add_yon_gidis", title: "Gidiş" } },
            { type: "reply", reply: { id: "add_yon_donus", title: "Dönüş" } }
          ]
        }
      }
    });
  }

  // Step 3: Yon Selected -> Ask Kalkis Yeri
  if (session.admin_step === 3 && message.type === 'interactive') {
    const yonId = message.interactive.button_reply.id;
    const yon = yonId.includes('gidis') ? "Gidis" : "Donus";
    
    updateSession(phone, { admin_step: 4, admin_yon: yon });
    
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Kalkış yerini seçin:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "add_kalkis_mcd", title: "Mecidiyeköy" } },
            { type: "reply", reply: { id: "add_kalkis_hac", title: "Hacıosman" } },
            { type: "reply", reply: { id: "add_kalkis_plaj", title: "Plaj" } }
          ]
        }
      }
    });
  }

  // Step 4: Kalkis Yeri Selected -> Ask Saat (Text)
  if (session.admin_step === 4 && message.type === 'interactive') {
    const kalkisId = message.interactive.button_reply.id;
    let kalkis = "Haciosman Metro";
    if (kalkisId.includes('mcd')) kalkis = "Mecidiyeköy";
    if (kalkisId.includes('plaj')) kalkis = "Plaj";
    
    updateSession(phone, { admin_step: 5, admin_kalkis: kalkis });
    
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: "Lütfen eklenecek saati 00:00 formatında yazıp gönderin (Örn: 08:30 veya 17:00):" }
    });
  }

  // Step 5: Saat Entered (Text) -> Save to DB
  if (session.admin_step === 5 && message.type === 'text') {
    const saatInput = message.text.body.trim();
    
    // Validate format
    if (!/^\d{1,2}[:.]\d{2}$/.test(saatInput)) {
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "❌ Hatalı format. Lütfen saati 08:30, 14:00 şeklinde yazınız." } });
    }
    
    const formattedSaat = saatInput.replace('.', ':');

    try {
      await addTripTemplate(session.admin_yon, session.admin_kalkis, formattedSaat, session.admin_gun);
      resetSession(phone);
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: `🎉 Başarılı! \n\n${session.admin_gun} - ${session.admin_yon}\n${session.admin_kalkis} - ${formattedSaat}\n\nSaat başarıyla eklendi ve anında WhatsApp menüsüne yansıdı.` }
      });
    } catch (e) {
      console.error(e);
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "❌ Kayıt sırasında bir hata oluştu." } });
    }
  }

  // Step 10: Setting Key Selected -> Ask for new value
  if (session.admin_step === 10 && message.type === 'interactive' && message.interactive.list_reply) {
    const settingId = message.interactive.list_reply.id.replace('set_', '');
    const settingTitle = message.interactive.list_reply.title;
    
    updateSession(phone, { admin_step: 11, setting_key: settingId });
    
    const { getSetting } = require('./settingsManager');
    const currentValue = getSetting(settingId);
    
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: `✏️ *${settingTitle}* ayarını düzenliyorsunuz.\n\nMevcut metin:\n_${currentValue}_\n\nLütfen yeni metni yazıp gönderin (İşlemi iptal etmek için 'iptal' yazabilirsiniz):` }
    });
  }

  // Step 11: New Setting Value Entered -> Save to settings.json
  if (session.admin_step === 11 && message.type === 'text') {
    const newValue = message.text.body.trim();
    
    const { updateSetting } = require('./settingsManager');
    updateSetting(session.setting_key, newValue);
    
    resetSession(phone);
    await sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: "✅ Ayar başarıyla güncellendi ve anında canlı sisteme yansıdı!" }
    });
    return sendAdminMainMenu(phone);
  }

  // Fallback
  return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Admin işlemi anlaşılamadı. 'İptal' diyerek çıkabilirsiniz." } });
}

const { getDailyReservations } = require('./supabase');

async function sendDailySummaryToAdmin(phone) {
  try {
    const t = getTurkeyTime();
    const todayStr = t.toISOString().split('T')[0];
    
    const tomorrow = new Date(t);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Fetch reservations
    const resToday = await getDailyReservations(todayStr);
    const resTomorrow = await getDailyReservations(tomorrowStr);
    
    // Filter active ones
    const activeToday = resToday.filter(r => r.durum === 'Beklemede' || r.durum === 'Onaylandı');
    const activeTomorrow = resTomorrow.filter(r => r.durum === 'Beklemede' || r.durum === 'Onaylandı');
    
    let msgBody = `📊 *REZERVASYON ÖZETİ*\n\n`;

    // --- TODAY ---
    msgBody += `📅 *BUGÜN (${todayStr})*\n`;
    if (activeToday.length === 0) {
      msgBody += `_Bugün için kayıtlı rezervasyon bulunmuyor._\n\n`;
    } else {
      const groupedToday = {};
      activeToday.forEach(res => {
        const trip = res.trips || {};
        const saat = trip.saat ? trip.saat.substring(0, 5) : 'Bilinmeyen Saat';
        const kalkis = trip.kalkis_yeri || 'Bilinmeyen Durak';
        const yon = trip.yon || 'Bilinmeyen Yön';
        const key = `${saat} - ${kalkis} (${yon})`;
        
        if (!groupedToday[key]) groupedToday[key] = { title: key, totalPax: 0, passengers: [] };
        groupedToday[key].totalPax += (res.kisi_sayisi || 1);
        groupedToday[key].passengers.push(`• ${res.ad_soyad} (${res.kisi_sayisi} Kişi) - ${res.durum}`);
      });

      const sortedToday = Object.keys(groupedToday).sort();
      sortedToday.forEach(key => {
        const group = groupedToday[key];
        msgBody += `🚐 *${group.title}* (Toplam: ${group.totalPax} Kişi)\n`;
        group.passengers.forEach(p => { msgBody += `${p}\n`; });
        msgBody += `\n`;
      });
    }
    
    msgBody += `➖➖➖➖➖➖➖➖\n\n`;

    // --- TOMORROW ---
    msgBody += `📅 *YARIN (${tomorrowStr})*\n`;
    if (activeTomorrow.length === 0) {
      msgBody += `_Yarın için henüz rezervasyon bulunmuyor._\n`;
    } else {
      const groupedTomorrow = {};
      activeTomorrow.forEach(res => {
        const trip = res.trips || {};
        const saat = trip.saat ? trip.saat.substring(0, 5) : 'Bilinmeyen Saat';
        const kalkis = trip.kalkis_yeri || 'Bilinmeyen Durak';
        const yon = trip.yon || 'Bilinmeyen Yön';
        const key = `${saat} - ${kalkis} (${yon})`;
        
        if (!groupedTomorrow[key]) groupedTomorrow[key] = { title: key, totalPax: 0, passengers: [] };
        groupedTomorrow[key].totalPax += (res.kisi_sayisi || 1);
        groupedTomorrow[key].passengers.push(`• ${res.ad_soyad} (${res.kisi_sayisi} Kişi) - ${res.durum}`);
      });

      const sortedTomorrow = Object.keys(groupedTomorrow).sort();
      sortedTomorrow.forEach(key => {
        const group = groupedTomorrow[key];
        msgBody += `🚐 *${group.title}* (Toplam: ${group.totalPax} Kişi)\n`;
        group.passengers.forEach(p => { msgBody += `${p}\n`; });
        msgBody += `\n`;
      });
    }

    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: msgBody }
    });
    
  } catch (err) {
    console.error("Error generating daily summary:", err);
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: "❌ Özet alınırken bir hata oluştu." }
    });
  }
}

module.exports = {
  sendAdminMainMenu,
  handleAdminFlow,
  sendDailySummaryToAdmin
};
