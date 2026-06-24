require('dotenv').config();
const { supabase } = require('./supabase');
async function test() {
  const { data, error } = await supabase.from('trip_templates').insert([{ yon: 'Gidis', kalkis_yeri: 'Mecidiyeköy (Pazartesi)', saat: '09:00', gun_tipi: 'Haftaici', aktif: true }]);
  console.log('Error:', error);
  if (!error) await supabase.from('trip_templates').delete().eq('saat', '09:00').eq('kalkis_yeri', 'Mecidiyeköy (Pazartesi)');
}
test();
