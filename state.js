// In-memory session state management
// sessions[phone] = { step, selected_day, selected_time, selected_count, updated_at }
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: 0, lang: 'tr', selected_day: null, selected_time: null, selected_count: null, selected_name: null, updated_at: Date.now() };
  }
  return sessions[phone];
}

function updateSession(phone, updates) {
  const session = getSession(phone);
  sessions[phone] = { ...session, ...updates, updated_at: Date.now() };
  return sessions[phone];
}

function resetSession(phone) {
  const currentLang = sessions[phone] ? sessions[phone].lang : 'tr';
  sessions[phone] = { step: 0, lang: currentLang, selected_day: null, selected_time: null, selected_count: null, selected_name: null, updated_at: Date.now() };
  return sessions[phone];
}

function cleanUpSessions() {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  
  for (const phone in sessions) {
    if (now - sessions[phone].updated_at > ONE_DAY) {
      delete sessions[phone];
      deletedCount++;
    }
  }
  console.log(`[Temizlik] ${deletedCount} adet inaktif oturum RAM'den silindi.`);
}

module.exports = {
  getSession,
  updateSession,
  resetSession,
  cleanUpSessions
};
