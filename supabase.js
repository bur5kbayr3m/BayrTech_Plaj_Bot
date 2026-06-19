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
  
  // We save lokasyon_adi directly to avoid relation lookup issues for now
  const lokasyon_adi = time; // e.g. "Hacıosman 10:30"

  const { data, error } = await supabase
    .from('reservations')
    .insert([
      { 
        tel_no: phone,
        ad_soyad: name,
        lokasyon_adi: lokasyon_adi,
        kisi_sayisi: passenger_count, // Must be an integer so that the database trigger doesn't crash on Approve!
        sefer_id: 'a4cd0abd-837d-42f5-896c-295c202e4432', // Dummy or default ID required by Supabase constraint
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

module.exports = {
  supabase,
  saveReservation,
  updateReservationStatus,
  getDailyReservations
};
