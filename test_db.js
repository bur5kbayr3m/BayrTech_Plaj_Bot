const { supabase } = require('./supabase');
async function test() {
  const { data } = await supabase.from('trips').select('tarih, saat, kalkis_yeri, toplam_kapasite, rezerve_edilen').eq('saat', '08:00:00').eq('kalkis_yeri', 'Mecidiyeköy Vakıfbank Önü (Cuma)');
  console.log(data);
}
test();
