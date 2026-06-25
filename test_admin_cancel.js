require('dotenv').config();
const { cancelReservation, supabase } = require('./supabase');

async function test() {
  try {
    const { data: resData } = await supabase.from('reservations').select('id, tel_no, ad_soyad').eq('durum', 'Onaylandı').limit(1).single();
    if (!resData) {
       console.log("No approved reservation found");
       return;
    }
    console.log("Testing cancel for:", resData);
    
    // Simulate what admin.js does:
    // Actually I don't want to REALLY cancel a real customer!
    // I will just see if there's any obvious syntax error.
    
    // In admin.js:
    // const customerSession = getSession(resData.tel_no) || { lang: 'tr' };
    
    // Is getSession defined in admin.js?
    // Let's check admin.js for getSession.
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
