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
  
  // Parse time
  let saat = "10:30:00";
  let kalkis = "Haciosman Metro";
  if (time.includes('08:00')) { saat = "08:00:00"; kalkis = "Mecidiyekoy"; }
  else if (time.includes('10:30')) { saat = "10:30:00"; kalkis = "Haciosman Metro"; }
  else if (time.includes('12:00')) { saat = "12:00:00"; kalkis = "Haciosman Metro"; }
  else if (time.includes('17:00')) { saat = "17:00:00"; kalkis = "Plaj"; }
  else if (time.includes('19:00')) { saat = "19:00:00"; kalkis = "Plaj"; }

  // Lookup trip
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('tarih', dateStr)
    .eq('saat', saat)
    .limit(1)
    .single();
    
  // Fallback to dummy if not found so it doesn't crash completely
  const sefer_id = trip ? trip.id : 'a4cd0abd-837d-42f5-896c-295c202e4432';

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
  const { data, error } = await supabase
    .from('reservations')
    .update({ durum: newStatus })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

async function getDailyReservations() {
  if (!supabase) throw new Error('Supabase not configured');
  
  // Normalde yarının tarihine göre filtreleme yapılır: .eq('day', 'Yarın') veya trip tablosu üzerinden tarih filtresi.
  // Test için tüm 'Onaylandı' olanları getiriyoruz.
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
    `)
    .eq('durum', 'Onaylandı');
    
  if (error) throw error;
  return data;
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

module.exports = {
  supabase,
  saveReservation,
  getLatestReservation,
  cancelReservation,
  updateReservationStatus,
  getDailyReservations
};
