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
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Isim Soyisim', 40, doc.y, { continued: true, width: 180 });
        doc.text('Telefon', 220, doc.y, { continued: true, width: 150 });
        doc.text('Kisi', 370, doc.y, { continued: true, width: 50 });
        doc.text('Kalkis Yeri', 420, doc.y, { continued: true, width: 160 });
        doc.text('Sefer Tarihi / Saati', 580, doc.y);
        
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(780, doc.y).stroke();
        doc.moveDown(0.5);

        // Table Rows
        doc.font('Helvetica');
        reservations.forEach((res) => {
          const trip = res.trips || {};
          const adSoyad = replaceTurkishChars(res.ad_soyad || 'Bilinmiyor');
          const kalkis = replaceTurkishChars(trip.kalkis_yeri || 'Bilinmiyor');
          const tarihSaat = `${trip.tarih || ''} ${trip.saat || ''}`;
          const tel = `+${res.tel_no}`;
          const kisi = `${res.kisi_sayisi}`;
          
          doc.text(adSoyad, 40, doc.y, { continued: true, width: 180 });
          doc.text(tel, 220, doc.y, { continued: true, width: 150 });
          doc.text(kisi, 370, doc.y, { continued: true, width: 50 });
          doc.text(kalkis, 420, doc.y, { continued: true, width: 160 });
          doc.text(tarihSaat, 580, doc.y);
          
          doc.moveDown(0.5);
          doc.moveTo(40, doc.y).lineTo(780, doc.y).strokeColor('#cccccc').stroke();
          doc.strokeColor('#000000'); // Reset stroke color
          doc.moveDown(0.5);
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
