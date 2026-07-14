const { sendMessage } = require('./whatsapp');
const { updateSession, resetSession } = require('./state');
const { addTripTemplate, removeTripTemplate, removeTripTemplateById, removeTripTemplateGroup, getTripTemplates } = require('./supabase');

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

async function showDeletionList(phone, gun, session) {
  const templates = await getTripTemplates();
  let filtered = [];
  const specificDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const weekendDays = ["Cumartesi", "Pazar"];
  
  let rows = [];
  
  if (gun === 'Tum_Haftaici' || gun === 'Tum_Haftasonu') {
    const targetGunTipi = gun === 'Tum_Haftaici' ? 'Haftaici' : 'Haftasonu';
    const allTargetTrips = templates.filter(t => t.gun_tipi === targetGunTipi);
    
    const grouped = {};
    for (const t of allTargetTrips) {
      let baseKalkis = t.kalkis_yeri;
      const bracketIdx = baseKalkis.lastIndexOf(' (');
      if (bracketIdx !== -1) {
        baseKalkis = baseKalkis.substring(0, bracketIdx);
      }
      const key = `${t.saat}_${t.yon}_${baseKalkis}`;
      if (!grouped[key]) {
        grouped[key] = { saat: t.saat, yon: t.yon, baseKalkis: baseKalkis, gun_tipi: targetGunTipi };
      }
    }
    
    const groupValues = Object.values(grouped);
    if (groupValues.length > 0) {
      filtered = [1]; // bypass empty check
      rows = groupValues.slice(0, 10).map(g => ({
        // Limit id to standard chars to be safe. We replace spaces with underscores in baseKalkis
        id: `del_grp_${g.saat}_${g.yon}_${g.baseKalkis.replace(/ /g, '_')}_${g.gun_tipi}`.substring(0, 200),
        title: `${g.saat} ${g.baseKalkis}`.substring(0, 24),
        description: `Tüm ${g.gun_tipi} silinecek`
      }));
    }
  } else {
    if (specificDays.includes(gun)) {
      filtered = templates.filter(t => t.gun_tipi === 'Haftaici' && t.kalkis_yeri.includes(`(${gun})`));
    } else if (weekendDays.includes(gun)) {
      filtered = templates.filter(t => t.gun_tipi === 'Haftasonu' && t.kalkis_yeri.includes(`(${gun})`));
    }
    
    rows = filtered.slice(0, 10).map(t => ({
      id: `del_tmp_${t.id}`,
      title: `${t.saat} ${t.kalkis_yeri}`.substring(0, 24),
      description: `${t.gun_tipi} - ${t.yon}`
    }));
  }
  
  if (rows.length === 0) {
    updateSession(phone, { admin_step: 1 });
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: `Sistemde bu kriterlere uygun kayıtlı sefer bulunmuyor.` },
        action: { buttons: [{ type: "reply", reply: { id: "menu_ana", title: "🏠 Ana Menü" } }] }
      }
    });
  }
  
  updateSession(phone, { admin_step: 99 });
  try {
    await sendMessage({
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
  } catch (e) {
    console.error("Error sending delete list:", e);
    updateSession(phone, { admin_step: 1 });
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Hata! Çok fazla uzun sefer adı var veya liste oluşturulamadı." },
        action: { buttons: [{ type: "reply", reply: { id: "menu_ana", title: "🏠 Ana Menü" } }] }
      }
    });
  }
}

async function handleAdminFlow(phone, message, session) {
  // Check if it's a cancellation
  const isButtonCancel = message.type === 'interactive' && message.interactive.button_reply && message.interactive.button_reply.id === 'admin_iptal';
  const textBody = message.type === 'text' ? message.text.body.trim().replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase() : '';
  const isTextCancel = message.type === 'text' && (textBody === 'iptal' || textBody === 'çıkış');
  
  const isButtonAnaMenu = message.type === 'interactive' && message.interactive.button_reply && message.interactive.button_reply.id === 'menu_ana';
  if (isButtonAnaMenu) {
    updateSession(phone, { admin_step: 1 });
    return sendAdminMainMenu(phone);
  }

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
    
    if (action === 'admin_saat_sil' || action === 'admin_saat_ekle') {
      const isAdd = action === 'admin_saat_ekle';
      updateSession(phone, { admin_step: 25, admin_action: isAdd ? 'add' : 'delete' });
      
      const prefix = isAdd ? 'add_day_' : 'del_day_';
      const promptTxt = isAdd ? "📅 Hangi güne saat EKLEMEK istiyorsunuz?" : "📅 Hangi günün saatini SİLMEK istiyorsunuz?";
      const suffixTxt = isAdd ? "ekler" : "siler";
      
      let rows = [
        { id: `${prefix}Pazartesi`, title: "Pazartesi" },
        { id: `${prefix}Salı`, title: "Salı" },
        { id: `${prefix}Çarşamba`, title: "Çarşamba" },
        { id: `${prefix}Perşembe`, title: "Perşembe" },
        { id: `${prefix}Cuma`, title: "Cuma" },
        { id: `${prefix}Cumartesi`, title: "Cumartesi" },
        { id: `${prefix}Pazar`, title: "Pazar" }
      ];
      
      rows.unshift({ id: `${prefix}Tum_Haftasonu`, title: "Tüm Haftasonu", description: `Cumartesi ve Pazar'dan ${suffixTxt}` });
      rows.unshift({ id: `${prefix}Tum_Haftaici`, title: "Tüm Haftaiçi", description: `Haftaiçi 5 günden ${suffixTxt}` });

      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "📅 Gün Seçimi" },
          body: { text: promptTxt },
          action: {
            button: "Gün Seç",
            sections: [{
              title: "Günler",
              rows: rows
            }]
          }
        }
      });
    }
  }



  // Deletion Step 2: Trip Selected -> Delete
  if (session.admin_step === 99 && message.type === 'interactive' && message.interactive.list_reply) {
    const replyId = message.interactive.list_reply.id; 
    const title = message.interactive.list_reply.title;
    
    try {
      if (replyId.startsWith('del_grp_')) {
        const parts = replyId.split('_');
        const gun_tipi_grp = parts.pop();
        const saat_grp = parts[2];
        const yon_grp = parts[3];
        const baseKalkisTokens = [];
        for (let i = 4; i < parts.length; i++) {
            baseKalkisTokens.push(parts[i]);
        }
        const baseKalkis_grp = baseKalkisTokens.join(' ');
        
        await removeTripTemplateGroup(saat_grp, yon_grp, baseKalkis_grp, gun_tipi_grp);
      } else {
        const tripId = replyId.replace('del_tmp_', '');
        await removeTripTemplateById(tripId);
      }
      updateSession(phone, { admin_step: 1 });
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: `✅ ${title} menüden başarıyla SİLİNDİ.` },
          action: { buttons: [{ type: "reply", reply: { id: "menu_ana", title: "🏠 Ana Menü" } }] }
        }
      });
    } catch (e) {
      updateSession(phone, { admin_step: 1 });
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "❌ Silme işlemi başarısız oldu." },
          action: { buttons: [{ type: "reply", reply: { id: "menu_ana", title: "🏠 Ana Menü" } }] }
        }
      });
    }
  }



  // Step 2.5: Specific Day Selected -> Ask Yon (or Show Trips for Delete)
  if (session.admin_step === 25 && message.type === 'interactive' && message.interactive.list_reply) {
    const listId = message.interactive.list_reply.id;
    const dayId = listId.replace('add_day_', '').replace('del_day_', '');
    
    if (session.admin_action === 'delete') {
      updateSession(phone, { admin_step: 202, admin_gun: dayId });
      return showDeletionList(phone, dayId, session);
    } else {
      updateSession(phone, { admin_step: 3, admin_gun: dayId });

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
  }

  // Step 3: Yon Selected -> Ask Kalkis Yeri
  if (session.admin_step === 3 && message.type === 'interactive') {
    const yonId = message.interactive.button_reply.id;
    const yon = yonId.includes('gidis') ? "Gidis" : "Donus";
    
    updateSession(phone, { admin_step: 4, admin_yon: yon });
    
    let promptText = yon === 'Donus' ? "Gidilecek yeri seçin:" : "Kalkış yerini seçin:";
    let buttons = [
      { type: "reply", reply: { id: "add_kalkis_mcd", title: "Mecidiyeköy" } },
      { type: "reply", reply: { id: "add_kalkis_hac", title: "Hacıosman" } }
    ];
    if (yon === 'Gidis') {
      buttons.push({ type: "reply", reply: { id: "add_kalkis_plaj", title: "Plaj" } });
    }

    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: promptText },
        action: { buttons: buttons }
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

    let gunTipi = session.admin_gun;
    let finalKalkis = session.admin_kalkis;
    
    const specificDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
    if (specificDays.includes(session.admin_gun)) {
      gunTipi = "Haftaici";
      finalKalkis = `${session.admin_kalkis} (${session.admin_gun})`;
    }
    
    const weekendDays = ["Cumartesi", "Pazar"];
    if (weekendDays.includes(session.admin_gun)) {
      gunTipi = "Haftasonu";
      finalKalkis = `${session.admin_kalkis} (${session.admin_gun})`;
    }

    try {
      if (session.admin_gun === 'Tum_Haftasonu') {
        await addTripTemplate(session.admin_yon, `${session.admin_kalkis} (Cumartesi)`, formattedSaat, 'Haftasonu');
        await addTripTemplate(session.admin_yon, `${session.admin_kalkis} (Pazar)`, formattedSaat, 'Haftasonu');
      } else if (session.admin_gun === 'Tum_Haftaici') {
        const allSpecificDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
        for (const day of allSpecificDays) {
          await addTripTemplate(session.admin_yon, `${session.admin_kalkis} (${day})`, formattedSaat, 'Haftaici');
        }
      } else {
        await addTripTemplate(session.admin_yon, finalKalkis, formattedSaat, gunTipi);
      }
      
      updateSession(phone, { admin_step: 1 });
      
      let dayText = session.admin_gun;
      if (session.admin_gun === 'Tum_Haftasonu') dayText = "Tüm Haftasonu (Cumartesi & Pazar)";
      if (session.admin_gun === 'Tum_Haftaici') dayText = "Tüm Haftaiçi (5 Gün)";
      
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: `🎉 Başarılı! \n\n${dayText} - ${session.admin_yon}\n${session.admin_kalkis} - ${formattedSaat}\n\nSaat başarıyla eklendi.` },
          action: { buttons: [{ type: "reply", reply: { id: "menu_ana", title: "🏠 Ana Menü" } }] }
        }
      });
    } catch (e) {
      console.error(e);
      updateSession(phone, { admin_step: 1 });
      return sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "❌ Kayıt sırasında bir hata oluştu." },
          action: { buttons: [{ type: "reply", reply: { id: "menu_ana", title: "🏠 Ana Menü" } }] }
        }
      });
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
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    const dayStr = `${y}-${m}-${d}`;
    
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
      
      const rows = Object.keys(grouped).slice(0, 9).map(key => ({
        id: key,
        title: grouped[key].title.substring(0, 24),
        description: `Toplam: ${grouped[key].pax} Kişi`
      }));
      
      rows.unshift({
        id: 'res_all_trips',
        title: 'Tüm Seferler',
        description: `${dayStr} tarihindeki tüm seferler`
      });
      
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

      if (selectedKey === 'res_all_trips') {
         let msgBody = `📋 *TÜM SEFERLER* (${dayStr})\n\n`;
         let overallTotal = 0;
         
         const groupedRes = {};
         activeRes.forEach(r => {
           const trip = r.trips || {};
           const saat = trip.saat ? trip.saat.substring(0, 5) : '00:00';
           const kalkis = trip.kalkis_yeri ? trip.kalkis_yeri.substring(0, 10) : 'Bilinmeyen';
           const yon = trip.yon === 'Gidis' ? 'Gidiş' : 'Dönüş';
           const k = `🚐 *${saat} ${kalkis} (${yon.substring(0,1)})*`;
           
           if (!groupedRes[k]) groupedRes[k] = [];
           groupedRes[k].push(r);
         });
         
         Object.keys(groupedRes).sort().forEach(k => {
           msgBody += `${k}\n\n`;
           let tripTotal = 0;
           let cap = null;
           groupedRes[k].forEach(res => {
             msgBody += `👤 *${res.ad_soyad}* (${res.kisi_sayisi} Kişi)\n`;
             msgBody += `📱 Müşteri: +${res.tel_no}\n`;
             msgBody += `Durum: ${res.durum}\n\n`;
             tripTotal += res.kisi_sayisi;
             overallTotal += res.kisi_sayisi;

             if (!cap && res.trips && res.trips.toplam_kapasite) {
               cap = res.trips.toplam_kapasite;
             }
           });
           msgBody += `*Sefer Toplamı: ${tripTotal}*\n`;
           if (cap) {
             msgBody += `📊 *Kontenjan:* ${tripTotal} / ${cap} Dolu *(Boş: ${cap - tripTotal})*\n`;
           }
           msgBody += `---------------------------\n\n`;
         });
         msgBody += `*Genel Toplam Yolcu: ${overallTotal}*`;
         
         await sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: msgBody } });
         filteredRes = activeRes;
      } else {
         if (selectedKey.startsWith('res_trip_')) {
           const tripId = selectedKey.replace('res_trip_', '');
           filteredRes = activeRes.filter(r => r.trip_id === tripId);
         } else {
           const parts = selectedKey.replace('res_key_', '').split('_');
           filteredRes = activeRes.filter(r => r.trips && r.trips.saat.startsWith(parts[0]));
         }
         
         let msgBody = `🚐 *${title}* (${dayStr})\n\n`;
         let totalPax = 0;
         let cap = null;
         
         filteredRes.forEach(res => {
           msgBody += `👤 *${res.ad_soyad}* (${res.kisi_sayisi} Kişi)\n`;
           msgBody += `📱 Müşteri: +${res.tel_no}\n`;
           msgBody += `Durum: ${res.durum}\n\n`;
           totalPax += res.kisi_sayisi;

           if (!cap && res.trips && res.trips.toplam_kapasite) {
             cap = res.trips.toplam_kapasite;
           }
         });
         
         msgBody += `*Toplam Yolcu: ${totalPax}*`;
         if (cap) {
           msgBody += `\n📊 *Kontenjan:* ${totalPax} / ${cap} Dolu\n*(Kalan Boş Yer: ${cap - totalPax})*\n`;
         }
         await sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: msgBody } });
      }
      
      if (filteredRes.length > 0 && selectedKey !== 'res_all_trips') {
        const rows = filteredRes.map(r => ({
           id: `adm_can_${r.id}`,
           title: r.ad_soyad.substring(0, 24),
           description: `+${r.tel_no} - ${r.kisi_sayisi} Kişi`
        }));
        
        const sections = [];
        for (let i = 0; i < rows.length; i += 10) {
          const pageNum = Math.floor(i / 10) + 1;
          if (pageNum > 10) break; // WhatsApp max 10 sections
          sections.push({
            title: `Yolcular ${pageNum}`,
            rows: rows.slice(i, i + 10)
          });
        }

        updateSession(phone, { admin_step: 103 });
        return sendMessage({
          messaging_product: "whatsapp",
          to: phone,
          type: "interactive",
          interactive: {
            type: "list",
            header: { type: "text", text: "❌ Rezervasyon İptali" },
            body: { text: "İptal etmek istediğiniz rezervasyonu listeden seçebilirsiniz:" },
            action: { button: "Yolcu Seç", sections: sections }
          }
        });
      }
      
      resetSession(phone);
      return;
    } catch (err) {
      console.error("Error in admin_step 102:", err);
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Detaylar getirilirken bir hata oluştu." } });
    }
  }

  // Reservation Step 3: Passenger Selected for Cancellation -> Confirm
  if (session.admin_step === 103) {
    if (message.type !== 'interactive' || !message.interactive.list_reply) {
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "İşlem iptal edildi. Ana menüye dönebilirsiniz." } });
    }
    const resId = message.interactive.list_reply.id.replace('adm_can_', '');
    const resName = message.interactive.list_reply.title;
    
    updateSession(phone, { admin_step: 104, cancel_res_id: resId });
    return sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: `⚠️ *${resName}* isimli yolcunun rezervasyonunu iptal etmek istediğinize emin misiniz?\n\n(Onaylarsanız müşteriye otomatik olarak iptal bilgilendirmesi gönderilecektir.)` },
        action: {
          buttons: [
            { type: "reply", reply: { id: "confirm_adm_cancel_yes", title: "Evet, İptal Et" } },
            { type: "reply", reply: { id: "confirm_adm_cancel_no", title: "Hayır, Vazgeç" } }
          ]
        }
      }
    });
  }

  // Reservation Step 4: Execute Cancellation
  if (session.admin_step === 104) {
    if (message.type !== 'interactive' || !message.interactive.button_reply) {
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "İşlem iptal edildi." } });
    }
    
    const btnId = message.interactive.button_reply.id;
    if (btnId === 'confirm_adm_cancel_no') {
      resetSession(phone);
      return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "İptal işlemi durduruldu. Ana menüye dönebilirsiniz." } });
    }
    
    if (btnId === 'confirm_adm_cancel_yes') {
      const resId = session.cancel_res_id;
      try {
        const { cancelReservation, supabase } = require('./supabase');
        const { data: resData } = await supabase.from('reservations').select('tel_no, ad_soyad').eq('id', resId).single();
        
        await cancelReservation(resId);
        
        if (resData) {
          const cancelMsg = "❌ Rezervasyonunuz yönetim tarafından iptal edilmiştir.";
          
          await sendMessage({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: resData.tel_no,
            type: "text",
            text: { body: cancelMsg }
          });
        }
        
        resetSession(phone);
        return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: `✅ *${resData ? resData.ad_soyad : 'Yolcu'}* rezervasyonu başarıyla iptal edildi ve müşteriye bilgi SMS'i gönderildi.` } });
      } catch(e) {
        console.error("Admin cancel execution error:", e);
        resetSession(phone);
        return sendMessage({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: "❌ İptal işlemi sırasında bir hata oluştu." } });
      }
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
          { type: "reply", reply: { id: "res_day_yarin", title: "Yarın" } }
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
