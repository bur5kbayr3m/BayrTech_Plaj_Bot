const moment = require('moment-timezone');

function generateDays() {
  const days = [];
  const today = moment().tz('Europe/Istanbul');
  
  days.push({ id: "day_0", title: `Bugün (${today.format('dddd')})` });
  days.push({ id: "day_1", title: `Yarın (${today.clone().add(1, 'days').format('dddd')})` });
  days.push({ id: "day_2", title: today.clone().add(2, 'days').format('dddd') });
  days.push({ id: "day_3", title: today.clone().add(3, 'days').format('dddd') });
  
  return days;
}

function generateTrips(isToday) {
  const now = moment().tz('Europe/Istanbul');
  const currentTimeInt = now.hours() * 100 + now.minutes(); // e.g., 2030 for 20:30

  const allTrips = [
    { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00", timeInt: 800, type: "gidis" },
    { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30", timeInt: 1030, type: "gidis" },
    { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00", timeInt: 1200, type: "gidis" },
    { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00", timeInt: 1700, type: "donus" },
    { id: "sefer_donus_hac_1900", title: "Hacıosman 19:00", timeInt: 1900, type: "donus" }
  ];

  let filtered = allTrips;
  if (isToday) {
    filtered = allTrips.filter(t => t.timeInt > currentTimeInt);
  }
  return filtered;
}

console.log('Days:', generateDays());
console.log('Trips for today:', generateTrips(true));

