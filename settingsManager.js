const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');

const defaultSettings = {
  faq_iptal_tr: "Rezervasyon iptali veya değişikliği yapılamamaktadır.",
  faq_iptal_en: "Reservations cannot be cancelled or modified.",
  faq_shuttle_tr: "Evet, plaj giriş ücretimize gidiş-dönüş ulaşım dahildir.",
  faq_shuttle_en: "Yes, round-trip transportation is included in the entrance fee.",
  faq_yemek_tr: "Plajımıza dışarıdan yiyecek ve içecek getirilmesi yasaktır.",
  faq_yemek_en: "Outside food and drinks are not allowed on the beach.",
  faq_ucret_tr: "Mecidiyeköy 350 TL, Hacıosman 300 TL kişi başı tek gidiş ücretidir.\n\n*TEK GİDİŞ FİYATIDIR.*",
  faq_ucret_en: "From Mecidiyeköy 350 TL, from Hacıosman 300 TL per person for a one-way trip.\n\n*ONE-WAY PRICE ONLY.*",
  faq_konum_tr: "Plajımız Kilyos'ta yer almaktadır. Seferlerimiz aşağıdaki noktalardan kalkmaktadır:\n\n📍 Hacıosman Metro:\nhttps://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw\n\n📍 Mecidiyeköy Vakıfbank:\nhttps://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw",
  faq_konum_en: "Our beach is located in Kilyos. Shuttles depart from:\n\n📍 Hacıosman Metro:\nhttps://maps.app.goo.gl/8vFYmQCcdzYN1HCu8?g_st=iw\n\n📍 Mecidiyeköy Vakıfbank:\nhttps://maps.app.goo.gl/5DTtenCnGYM8Qf24A?g_st=iw",
  faq_saat_tr: "Belirtilen noktadan araç kalkacaktır. Servise ulaşmak için 0545 578 41 53 numarasını direkt olarak arayabilirsiniz eğer aracı bulamazsanız.",
  faq_saat_en: "The vehicle will depart from the specified point. If you cannot find the vehicle, you can directly call 0545 578 41 53 to reach the shuttle.",
  contact_phone: "0545 578 41 53",
  donus_info_tr: "_Not: Dönüşte rezervasyon yoktur. Kalkıştan 10-15 dk önce araca doğrudan binebilirsiniz._",
  donus_info_en: "_Note: Return trips do not require reservations. You can board the vehicle 10-15 mins before departure._",
  welcome_text_tr: "MERHABA 🌴\n\n🚐 SHUTTLE (TEK YÖN):\nHacıosman: 300₺\nMecidiyeköy: 350 ₺\n\n🏖️ PLAJ GİRİŞ ÜCRETİ\nHafta İçi: 800₺\nHafta Sonu: 1200₺\n\n(Şezlong, şemsiye, otopark, duş ve WC dahildir.)\n0-6 yaş ücretsiz\n7-12 yaş: yarı fiyat\n\n❗ Tek erkek ve erkek gruplarına hizmet vermemekteyiz.",
  welcome_text_en: "HELLO 🌴\n\n🚐 SHUTTLE (ONE WAY):\nHacıosman: 300₺\nMecidiyeköy: 350₺\n\n🏖️ BEACH ENTRANCE FEE\nWeekday: 800₺\nWeekend: 1200₺\n\n(Sunbed, umbrella, parking, shower and WC included.)\n0-6 years free\n7-12 years: half price\n\n⚠️ Entry without a female companion is not allowed."
};

function getSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return { ...defaultSettings, ...JSON.parse(data) };
  } catch (e) {
    console.error("Error reading settings.json:", e);
    return defaultSettings;
  }
}

function getSetting(key) {
  const settings = getSettings();
  return settings[key] !== undefined ? settings[key] : defaultSettings[key];
}

function updateSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

module.exports = {
  getSetting,
  updateSetting,
  getSettings
};
