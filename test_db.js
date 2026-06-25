const { supabase } = require('./supabase');
async function test() {
  const { data, error } = await supabase.rpc('get_schema');
  console.log(error);
}
test();
