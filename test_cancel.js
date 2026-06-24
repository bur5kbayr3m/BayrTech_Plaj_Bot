require('dotenv').config();
const { supabase } = require('./supabase');
async function testStatus(status) {
  const { data: res } = await supabase.from('reservations').select('id').limit(1);
  const { error: updErr } = await supabase.from('reservations').update({ durum: status }).eq('id', res[0].id);
  console.log(status, "->", updErr ? updErr.message : "SUCCESS");
}
testStatus('İptal');
testStatus('İPTAL');
testStatus('İptal edildi');
testStatus('iptal edildi');
