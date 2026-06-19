const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getDailyReservations, cleanUpDatabase } = require('./supabase');
const { sendPdfDocument } = require('./whatsapp');
const { cleanUpSessions } = require('./state');
require('dotenv').config();

const ADMIN_PHONE = process.env.ADMIN_PHONE;

function replaceTurkishChars(text) {
  if (!text) return '';
  const charMap = {
    'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I',
    'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
    'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
  };
  return text.replace(/[şŞıİğĞüÜöÖçÇ]/g, match => charMap[match]);
}

function generatePdf(reservations, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(22).text('GOGA BEACH GUNLUK REZERVASYON RAPORU', { align: 'center' });
      doc.moveDown();
      
      const todayStr = new Date().toLocaleDateString('tr-TR');
      doc.fontSize(12).text(`Olusturulma Tarihi: ${todayStr}`, { align: 'right' });
      doc.moveDown(2);

      if (!reservations || reservations.length === 0) {
        doc.fontSize(14).text('Bu rapor icin onaylanmis rezervasyon bulunmamaktadir.', { align: 'center' });
      } else {
        // Table Header
      const startY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Isim Soyisim', 40, startY, { lineBreak: false });
      doc.text('Telefon', 220, startY, { lineBreak: false });
      doc.text('Kisi', 370, startY, { lineBreak: false });
      doc.text('Kalkis Yeri', 420, startY, { lineBreak: false });
      doc.text('Saat', 580, startY, { lineBreak: false });
      
      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(780, doc.y).stroke();
      doc.moveDown(1);

      // Table Rows
      doc.font('Helvetica');
      reservations.forEach((res) => {
        const y = doc.y;
        
        // Clean texts
        const isim = replaceTurkishChars(res.ad_soyad).substring(0, 25); // truncate to avoid overflow
        const tel = replaceTurkishChars(res.tel_no);
        const kisi = res.kisi_sayisi ? res.kisi_sayisi.toString() : '1';
        const kalkis = res.trips && res.trips.kalkis_yeri ? replaceTurkishChars(res.trips.kalkis_yeri) : '-';
        const saat = res.trips && res.trips.saat ? res.trips.saat.substring(0,5) : '-';

        doc.text(isim, 40, y, { lineBreak: false });
        doc.text(tel, 220, y, { lineBreak: false });
        doc.text(kisi, 370, y, { lineBreak: false });
        doc.text(kalkis, 420, y, { lineBreak: false });
        doc.text(saat, 580, y, { lineBreak: false });
        
        doc.y = y + 15; // fixed row height
        doc.moveTo(40, doc.y).lineTo(780, doc.y).strokeColor('#cccccc').stroke();
        doc.strokeColor('#000000'); // Reset stroke color
        doc.y = doc.y + 10;
      });
      }

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function runDailyReport() {
  if (!ADMIN_PHONE) {
    console.log('ADMIN_PHONE tanımlı değil, rapor gönderilemiyor.');
    return;
  }
  
  console.log('Günlük PDF Raporu oluşturuluyor...');
  try {
    const reservations = await getDailyReservations();
    
    const fileName = `Rapor_${new Date().toISOString().split('T')[0]}.pdf`;
    
    const pdfDir = path.join(__dirname, 'public_pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir);
    }
    const filePath = path.join(pdfDir, fileName);
    
    await generatePdf(reservations, filePath);
    console.log(`PDF başarıyla oluşturuldu: ${filePath}`);
    
    // Uygulama URL'sini bul (Render üzerinde otomatik RENDER_EXTERNAL_URL var)
    const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'http://localhost:3000';
    const fileUrl = `${appUrl}/public_pdfs/${fileName}`;
    
    // Admine PDF gönder
    await sendPdfDocument(ADMIN_PHONE, fileUrl, fileName);
    console.log('Rapor admin numarasına gönderildi.');
    
    // Veritabanı ve Session Temizliği
    await cleanUpDatabase();
    cleanUpSessions();
    
  } catch (error) {
    console.error('PDF Rapor veya Temizlik sırasında hata oluştu:', error);
  }
}

// Her gün saat 24:00'te (00:00) çalışır
function startCronJobs() {
  cron.schedule('0 0 * * *', () => {
    runDailyReport();
  }, {
    timezone: "Europe/Istanbul"
  });
  console.log('📅 Cron job başlatıldı: Her gece 00:00\'da rapor gönderilecek.');
}

module.exports = {
  startCronJobs,
  runDailyReport
};
