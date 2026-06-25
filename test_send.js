const { supabase } = require('./supabase');
async function test() {
  const { data } = await supabase.from('reservations').select('*').is('tel_no', null);
  console.log("Null phones:", data.map(r => ({ name: r.ad_soyad, date: r.created_at })));
}
test();
