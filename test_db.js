require('dotenv').config();
const { saveReservation } = require('./supabase');

async function test() {
  try {
    const res = await saveReservation({
      phone: '905555555555',
      name: 'Test Name',
      day: 'Bugun',
      time: 'Haciosman 10:30',
      passenger_count: '👩 1 Kadin'
    });
    console.log('Success:', res);
  } catch (err) {
    console.error('DB Error:', err);
  }
}
test();
