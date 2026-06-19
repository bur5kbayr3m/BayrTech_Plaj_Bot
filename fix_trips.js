const fs = require('fs');
let code = fs.readFileSync('whatsapp.js', 'utf8');

const oldFunc = `async function sendTripSelectionList(phone, dayTitle) {
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: \`🚐 \${dayTitle} Günü Seferleri\`
      },
      body: {
        text: "Lütfen rezervasyon yapmak istediğiniz kalkış noktası ve saati seçin:"
      },
      action: {
        button: "⏱️ Sefer Seçiniz",
        sections: [
          {
            title: "🏖️ Gidiş Seferleri",
            rows: [
              { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00" },
              { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30" },
              { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00" }
            ]
          },
          {
            title: "🌆 Dönüş Seferleri",
            rows: [
              { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00" },
              { id: "sefer_donus_hac_1900", title: "Hacıosman 19:00" }
            ]
          }
        ]
      }
    }
  };
  return sendMessage(data);
}`;

const newFunc = `async function sendTripSelectionList(phone, dayTitle) {
  const t = getTurkeyTime();
  const isToday = dayTitle.startsWith('Bugün');
  const currentTimeInt = t.getHours() * 100 + t.getMinutes();

  const allGidis = [
    { id: "sefer_gidis_mcd_0800", title: "Mecidiyeköy 08:00", timeInt: 800 },
    { id: "sefer_gidis_hac_1030", title: "Hacıosman 10:30", timeInt: 1030 },
    { id: "sefer_gidis_hac_1200", title: "Hacıosman 12:00", timeInt: 1200 }
  ];

  const allDonus = [
    { id: "sefer_donus_hac_1700", title: "Hacıosman 17:00", timeInt: 1700 },
    { id: "sefer_donus_hac_1900", title: "Hacıosman 19:00", timeInt: 1900 }
  ];

  let availableGidis = allGidis;
  let availableDonus = allDonus;

  if (isToday) {
    availableGidis = allGidis.filter(trip => trip.timeInt > currentTimeInt);
    availableDonus = allDonus.filter(trip => trip.timeInt > currentTimeInt);
  }

  if (availableGidis.length === 0 && availableDonus.length === 0) {
    return sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: 'text',
      text: { body: \`Üzgünüz, \${dayTitle} için tüm servislerimizin saati geçmiştir. Lütfen farklı bir gün seçmek için ana menüye dönünüz.\` }
    });
  }

  const sections = [];
  if (availableGidis.length > 0) {
    sections.push({
      title: "🏖️ Gidiş Seferleri",
      rows: availableGidis.map(t => ({ id: t.id, title: t.title }))
    });
  }
  if (availableDonus.length > 0) {
    sections.push({
      title: "🌆 Dönüş Seferleri",
      rows: availableDonus.map(t => ({ id: t.id, title: t.title }))
    });
  }

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: \`🚐 \${dayTitle} Günü Seferleri\` },
      body: { text: "Lütfen rezervasyon yapmak istediğiniz kalkış noktası ve saati seçin:" },
      action: {
        button: "⏱️ Sefer Seçiniz",
        sections: sections
      }
    }
  };
  return sendMessage(data);
}`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('whatsapp.js', code);
console.log("Replaced sendTripSelectionList successfully.");
