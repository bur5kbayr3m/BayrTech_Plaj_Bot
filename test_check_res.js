require('dotenv').config();
const { supabase } = require('./supabase');

async function test() {
  const { data } = await supabase.from('reservations').select('id, durum, created_at, ad_soyad').order('created_at', { ascending: false }).limit(20);
  console.log(data);
}
test();
