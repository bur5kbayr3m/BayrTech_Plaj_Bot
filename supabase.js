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

async function saveReservation({ phone, day, time, passenger_count }) {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data: tripData, error: tripError } = await supabase
    .from('trips')
    .select('id')
    .eq('aktif', true)
    .limit(1)
    .single();

  if (tripError || !tripData) {
    console.warn('⚠️ Aktif bir sefer bulunamadı, sefer_id null olarak veya hatayla sonuçlanabilir.', tripError);
  }
  
  const sefer_id = tripData ? tripData.id : null;

  const { data, error } = await supabase
    .from('reservations')
    .insert([
      { 
        tel_no: phone, 
        sefer_id: sefer_id,
        kisi_sayisi: passenger_count, 
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
