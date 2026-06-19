const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getDailyReservations, cleanUpDatabase } = require('./supabase');
const { sendPdfDocument } = require('./whatsapp');
const { cleanUpSessions } = require('./state');
require('dotenv').config();

const ADMIN_PHONE = process.env.ADMIN_PHONE;

function generatePdf(reservations, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('Günlük Rezervasyon Raporu', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' });
      doc.moveDown(2);

      if (!reservations || reservations.length === 0) {
        doc.fontSize(14).text('Onaylanmış rezervasyon bulunmamaktadır.', { align: 'center' });
      } else {
        // Table Header
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Telefon', 50, doc.y, { continued: true, width: 150 });
        doc.text('Kişi', 200, doc.y, { continued: true, width: 50 });
        doc.text('Kalkış', 250, doc.y, { continued: true, width: 100 });
        doc.text('Tarih/Saat', 350, doc.y);
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Table Rows
        doc.font('Helvetica');
        reservations.forEach((res) => {
          const trip = res.trips || {};
          const kalkis = trip.kalkis_yeri || 'Bilinmiyor';
          const tarihSaat = `${trip.tarih || ''} ${trip.saat || ''}`;
          
          doc.text(`+${res.tel_no}`, 50, doc.y, { continued: true, width: 150 });
          doc.text(`${res.kisi_sayisi}`, 200, doc.y, { continued: true, width: 50 });
          doc.text(kalkis, 250, doc.y, { continued: true, width: 100 });
          doc.text(tarihSaat, 350, doc.y);
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
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
