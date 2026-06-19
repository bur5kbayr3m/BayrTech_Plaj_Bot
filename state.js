// In-memory session state management
// sessions[phone] = { step, selected_day, selected_time, selected_count }
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: 0, selected_day: null, selected_time: null, selected_count: null };
  }
  return sessions[phone];
}

function updateSession(phone, updates) {
  const session = getSession(phone);
  sessions[phone] = { ...session, ...updates };
  return sessions[phone];
}

function resetSession(phone) {
  sessions[phone] = { step: 0, selected_day: null, selected_time: null, selected_count: null };
  return sessions[phone];
}

module.exports = {
  getSession,
  updateSession,
  resetSession
};
