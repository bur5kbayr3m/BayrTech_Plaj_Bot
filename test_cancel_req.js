require('dotenv').config();
const { getLatestReservation } = require('./supabase');

async function test() {
  try {
    const latest = await getLatestReservation('905437894042'); // Any phone number
    console.log("Latest:", latest);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
