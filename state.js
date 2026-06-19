// In-memory session state management
// sessions[phone] = { step, selected_day, selected_time, selected_count }
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: 0, lang: 'tr', selected_day: null, selected_time: null, selected_count: null, selected_name: null };
  }
  return sessions[phone];
}

function updateSession(phone, updates) {
  const session = getSession(phone);
  sessions[phone] = { ...session, ...updates };
  return sessions[phone];
}

function resetSession(phone) {
  const currentLang = sessions[phone] ? sessions[phone].lang : 'tr';
  sessions[phone] = { step: 0, lang: currentLang, selected_day: null, selected_time: null, selected_count: null, selected_name: null };
  return sessions[phone];
}

module.exports = {
  getSession,
  updateSession,
  resetSession
};
