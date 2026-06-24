const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('⚠️ Supabase credentials not found. Database operations will fail.');
}

async function saveReservation({ phone, name, day, time, passenger_count }) {
  if (!supabase) throw new Error('Supabase not configured');
  
  const lokasyon_adi = time; // e.g. "Hacıosman 10:30" or "Mecidiyeköy 08:00"
  
  // Calculate date from day string "Bugün (Cuma)"
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const t = new Date(utc + (3600000 * 3));
  
  if (day.startsWith('Yarın') || day.startsWith('Tomorrow')) {
    t.setDate(t.getDate() + 1);
  } else if (!day.startsWith('Bugün') && !day.startsWith('Today')) {
    t.setDate(t.getDate() + 2); // 3. gun
  }
  
  const dateStr = t.toISOString().split('T')[0];
  
  // Parse time and yon dynamically
  let saat = "10:30:00";
  const timeMatch = time.match(/\d{2}:\d{2}/);
  if (timeMatch) {
    saat = timeMatch[0] + ":00";
  }
  
  let yon = "Gidis";
  if (time.toLowerCase().includes('dönüş') || time.toLowerCase().includes('donus')) {
    yon = "Donus";
  }
  
  let kalkis = "Haciosman Metro"; // fallback
  if (time.toLowerCase().includes('mecidiyeköy') || time.toLowerCase().includes('mcd')) {
    kalkis = "Mecidiyekoy";
  } else if (time.toLowerCase().includes('plaj')) {
    kalkis = "Plaj";
  } else if (time.toLowerCase().includes('hacıosman') || time.toLowerCase().includes('hac')) {
    kalkis = "Haciosman Metro";
  }

  // Lookup trip
  let { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('tarih', dateStr)
    .eq('saat', saat)
    .limit(1)
    .single();
    
  if (!trip) {
    const { data: newTrip, error: newTripErr } = await supabase
      .from('trips')
      .insert([{
        tarih: dateStr,
        saat: saat,
        yon: yon,
        kalkis_yeri: kalkis,
        varis_yeri: yon === 'Gidis' ? 'Plaj' : 'Haciosman Metro',
        toplam_kapasite: 16,
        rezerve_edilen: 0,
        aktif: true
      }])
      .select()
      .single();
      
    if (newTripErr) {
      console.error('Error auto-creating trip:', newTripErr);
      trip = { id: 'a4cd0abd-837d-42f5-896c-295c202e4432' }; // fallback safely
    } else {
      trip = newTrip;
      console.log(`[Otomatik Sefer] Yeni sefer oluşturuldu: ${dateStr} ${saat} ${kalkis}`);
    }
  }
  
  const sefer_id = trip.id;

  const { data, error } = await supabase
    .from('reservations')
    .insert([
      { 
        tel_no: phone,
        ad_soyad: name,
        lokasyon_adi: lokasyon_adi,
        kisi_sayisi: passenger_count, // Must be an integer so that the database trigger doesn't crash on Approve!
        sefer_id: sefer_id, 
        durum: 'Beklemede' 
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving reservation:', error);
    throw error;
  }
  return data;
}

async function updateReservationStatus(id, newStatus) {
  if (!supabase) throw new Error('Supabase not configured');
  
  // Get current status to see if we need to free up capacity
  const { data: currentRes } = await supabase.from('reservations').select('durum, kisi_sayisi, sefer_id').eq('id', id).single();
  
  const { data, error } = await supabase
    .from('reservations')
    .update({ durum: newStatus })
    .eq('id', id)
    .select(`
      *,
      trips:sefer_id (
        tarih,
        saat,
        kalkis_yeri
      )
    `)
    .single();
    
  if (error) throw error;
  
  // If moving FROM Onaylandı TO Reddedildi/İptal, the PG trigger doesn't decrement it, so we must do it manually!
  if (currentRes && currentRes.sefer_id) {
    if (currentRes.durum === 'Onaylandı' && (newStatus === 'Reddedildi' || newStatus === 'İptal Edildi')) {
      const { data: trip } = await supabase.from('trips').select('rezerve_edilen').eq('id', currentRes.sefer_id).single();
      if (trip) {
        const newQuota = Math.max(0, trip.rezerve_edilen - currentRes.kisi_sayisi);
        await supabase.from('trips').update({ rezerve_edilen: newQuota }).eq('id', currentRes.sefer_id);
      }
    }
  }
  
  return data;
}

async function getDailyReservations(targetDateStr) {
  if (!supabase) return [];
  
  if (!targetDateStr) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDateStr = tomorrow.toISOString().split('T')[0];
  }

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      trips:sefer_id (
        tarih,
        saat,
        kalkis_yeri,
        varis_yeri
      )
    `);
    
  if (error) throw error;
  
  // Filter for target date in memory
  return data.filter(res => res.trips && res.trips.tarih === targetDateStr);
}


async function getLatestReservation(phone) {
  const { data } = await supabase
    .from('reservations')
    .select('*')
    .eq('tel_no', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function cancelReservation(id) {
  // Fetch reservation and trip
  const { data: res } = await supabase.from('reservations').select('kisi_sayisi, sefer_id').eq('id', id).single();
  if (!res) throw new Error('Reservation not found');
  
  // Update status to İptal Edildi
  await supabase.from('reservations').update({ durum: 'İptal Edildi' }).eq('id', id);
  
  // Restore quota
  if (res.sefer_id) {
    const { data: trip } = await supabase.from('trips').select('rezerve_edilen').eq('id', res.sefer_id).single();
    if (trip) {
      const newQuota = Math.max(0, trip.rezerve_edilen - res.kisi_sayisi);
      await supabase.from('trips').update({ rezerve_edilen: newQuota }).eq('id', res.sefer_id);
    }
  }
}

async function getTripCapacity(seferId) {
  const { data, error } = await supabase
    .from('trips')
    .select('tarih, saat, kalkis_yeri, toplam_kapasite, rezerve_edilen')
    .eq('id', seferId)
    .single();
  if (error) throw error;
  return data;
}

async function increaseTripCapacity(seferId, amount = 16) {
  const trip = await getTripCapacity(seferId);
  const { data, error } = await supabase
    .from('trips')
    .update({ toplam_kapasite: trip.toplam_kapasite + amount })
    .eq('id', seferId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function cleanUpDatabase() {
  if (!supabase) return;
  console.log('[Temizlik] Veritabanı temizliği başlatılıyor...');
  try {
    // 1. Dünü biten İptal Edildi ve Reddedildi olanları sil
    const { error: err1 } = await supabase
      .from('reservations')
      .delete()
      .in('durum', ['Reddedildi', 'İptal Edildi']);
      
    if (err1) console.error('[Temizlik] Reddedilenler silinirken hata:', err1);
    else console.log('[Temizlik] Reddedilen/İptal edilen kayıtlar temizlendi.');

    // 2. Üzerinden 4 gün geçmiş eski kayıtları sil
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    
    const { error: err2 } = await supabase
      .from('reservations')
      .delete()
      .lt('created_at', fourDaysAgo.toISOString());
      
    if (err2) console.error('[Temizlik] Eski kayıtlar silinirken hata:', err2);
    else console.log('[Temizlik] 4 günden eski kayıtlar temizlendi.');
    
    // 3. 24 saatten eski ve adminin onaylamayı/reddetmeyi unuttuğu 'Beklemede' kayıtları sil
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { error: err3 } = await supabase
      .from('reservations')
      .delete()
      .eq('durum', 'Beklemede')
      .lt('created_at', oneDayAgo.toISOString());
      
    if (err3) console.error('[Temizlik] Eski beklemede olanlar silinirken hata:', err3);
    else console.log('[Temizlik] 1 günden eski Beklemede kayıtlar temizlendi.');
    
  } catch (err) {
    console.error('[Temizlik] Hata:', err);
  }
}

async function getTripTemplates(dayType) {
  if (!supabase) return [];
  let query = supabase.from('trip_templates').select('*').eq('aktif', true);
  if (dayType) {
    if (Array.isArray(dayType)) {
      query = query.in('gun_tipi', dayType);
    } else {
      query = query.in('gun_tipi', [dayType, 'Hergün']);
    }
  }
  const { data, error } = await query.order('saat', { ascending: true });
  if (error) {
    console.error('Error fetching trip templates:', error);
    return [];
  }
  return data;
}

async function addTripTemplate(yon, kalkis_yeri, saat, gun_tipi) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('trip_templates')
    .insert([{ yon, kalkis_yeri, saat, gun_tipi, aktif: true }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function removeTripTemplate(saat, kalkis_yeri) {
  if (!supabase) throw new Error('Supabase not configured');
  // Just disable it instead of hard delete to keep history if needed, or hard delete. Hard delete is simpler.
  const { error } = await supabase
    .from('trip_templates')
    .delete()
    .eq('saat', saat)
    .eq('kalkis_yeri', kalkis_yeri);
  if (error) throw error;
}

async function removeTripTemplateById(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('trip_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

module.exports = {
  supabase,
  saveReservation,
  getLatestReservation,
  cancelReservation,
  updateReservationStatus,
  getDailyReservations,
  getTripCapacity,
  increaseTripCapacity,
  cleanUpDatabase,
  getTripTemplates,
  addTripTemplate,
  removeTripTemplate,
  removeTripTemplateById
};
