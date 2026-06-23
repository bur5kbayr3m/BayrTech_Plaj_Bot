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
              { type: "reply", reply: { id: "del_gun_haftaici", title: "Haftaiçi" } }
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
              { type: "reply", reply: { id: "add_gun_haftaici", title: "Haftaiçi" } }
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

  // Reservation Step 1: Day Selected -> List Trips with Reservations
  if (session.admin_step === 101) {
    if (message.type !== 'interactive' || !message.interactive.button_reply) {
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Lütfen rezervasyonları görmek için yukarıdaki butonlardan (Bugün/Yarın/3. Gün) birine tıklayın." } });
    }
    
    const dayId = message.interactive.button_reply.id.replace('res_day_', '');
    
    const t = getTurkeyTime();
    if (dayId === 'yarin') {
      t.setDate(t.getDate() + 1);
    } else if (dayId === 'diger') {
      t.setDate(t.getDate() + 2);
    }
    const dayStr = t.toISOString().split('T')[0];
    
    try {
      const { getDailyReservations } = require('./supabase');
      const reservations = await getDailyReservations(dayStr);
      const activeRes = reservations.filter(r => r.durum === 'Beklemede' || r.durum === 'Onaylandı');
      
      if (activeRes.length === 0) {
        resetSession(phone);
        return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: `_Seçtiğiniz tarih (${dayStr}) için kayıtlı rezervasyon bulunmuyor._` } });
      }
      
      const grouped = {};
      activeRes.forEach(res => {
        const trip = res.trips || {};
        const saat = trip.saat ? trip.saat.substring(0, 5) : '00:00';
        const kalkis = trip.kalkis_yeri ? trip.kalkis_yeri.substring(0, 10) : 'Bilinmeyen';
        const yon = trip.yon === 'Gidis' ? 'Gidiş' : 'Dönüş';
        const key = `${saat} ${kalkis} (${yon.substring(0,1)})`;
        const internalKey = trip.id ? `res_trip_${trip.id}` : `res_key_${saat}_${kalkis}`;
        
        if (!grouped[internalKey]) grouped[internalKey] = { title: key, pax: 0, raw_date: dayStr };
        grouped[internalKey].pax += (res.kisi_sayisi || 1);
      });
      
      const rows = Object.keys(grouped).slice(0, 10).map(key => ({
        id: key,
        title: grouped[key].title.substring(0, 24),
        description: `Toplam: ${grouped[key].pax} Kişi`
      }));
      
      updateSession(phone, { admin_step: 102, res_day: dayStr });
      
      await sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: `📋 ${dayStr} Rezervasyonları` },
          body: { text: "İncelemek istediğiniz seferi seçin:" },
          action: { button: "Sefer Seç", sections: [{ title: "Kayıtlı Seferler", rows: rows }] }
        }
      });
      return;
    } catch (err) {
      console.error("Error in admin_step 101:", err);
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Rezervasyonlar getirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin." } });
    }
  }

  // Reservation Step 2: Trip Selected -> Show Details
  if (session.admin_step === 102) {
    if (message.type !== 'interactive' || !message.interactive.list_reply) {
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Lütfen detayını görmek istediğiniz seferi listeden seçin." } });
    }

    const selectedKey = message.interactive.list_reply.id;
    const title = message.interactive.list_reply.title;
    const dayStr = session.res_day;
    
    try {
      const { getDailyReservations } = require('./supabase');
      const reservations = await getDailyReservations(dayStr);
      const activeRes = reservations.filter(r => r.durum === 'Beklemede' || r.durum === 'Onaylandı');
      
      let filteredRes = [];
      if (selectedKey.startsWith('res_trip_')) {
        const tripId = parseInt(selectedKey.replace('res_trip_', ''));
        filteredRes = activeRes.filter(r => r.trip_id === tripId);
      } else {
        // Fallback matching
        const parts = selectedKey.replace('res_key_', '').split('_');
        filteredRes = activeRes.filter(r => r.trips && r.trips.saat.startsWith(parts[0]));
      }
      
      let msgBody = `🚐 *${title}* (${dayStr})\n\n`;
      let totalPax = 0;
      
      filteredRes.forEach(res => {
        msgBody += `👤 *${res.ad_soyad}* (${res.kisi_sayisi} Kişi)\n`;
        msgBody += `📱 Müşteri: +${res.musteri_tel}\n`;
        msgBody += `Durum: ${res.durum}\n\n`;
        totalPax += res.kisi_sayisi;
      });
      
      msgBody += `*Toplam Yolcu: ${totalPax}*`;
      
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: msgBody } });
    } catch (err) {
      console.error("Error in admin_step 102:", err);
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Detaylar getirilirken bir hata oluştu." } });
    }
  }

  // Fallback
  return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Admin işlemi anlaşılamadı. 'İptal' diyerek çıkabilirsiniz." } });
}

async function startAdminReservationFlow(phone) {
  updateSession(phone, { admin_step: 101 });
  return sendMessage({
    messaging_product: "whatsapp",
    to: phone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "📅 Hangi günün rezervasyonlarını görüntülemek istiyorsunuz?" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "res_day_bugun", title: "Bugün" } },
          { type: "reply", reply: { id: "res_day_yarin", title: "Yarın" } },
          { type: "reply", reply: { id: "res_day_diger", title: "3. Gün" } }
        ]
      }
    }
  });
}

module.exports = {
  sendAdminMainMenu,
  handleAdminFlow,
  startAdminReservationFlow
};
