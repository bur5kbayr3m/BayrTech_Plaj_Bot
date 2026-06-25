require('dotenv').config();
const { supabase } = require('./supabase');

async function update() {
  try {
    const { data, error } = await supabase
      .from('trips')
      .update({ toplam_kapasite: 15 })
      .eq('toplam_kapasite', 16);
      
    if (error) console.error("Error updating:", error);
    else console.log("Updated successfully");
  } catch(e) {
    console.error(e);
  }
}
update();
