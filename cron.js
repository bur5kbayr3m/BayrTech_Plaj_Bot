const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getDailyReservations } = require('./supabase');
const { sendPdfDocument } = require('./whatsapp');
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
    const filePath = path.join(__dirname, fileName);
    
    await generatePdf(reservations, filePath);
    console.log(`PDF başarıyla oluşturuldu: ${filePath}`);
    
    // Admine PDF gönder (Demo modunda simülasyon)
    await sendPdfDocument(ADMIN_PHONE, filePath, fileName);
    console.log('Rapor admin numarasına gönderildi.');
    
  } catch (error) {
    console.error('PDF Rapor oluşturulurken hata oluştu:', error);
  }
}

// Her gün saat 20:00'de çalışır
function startCronJobs() {
  cron.schedule('0 20 * * *', () => {
    runDailyReport();
  });
  console.log('📅 Cron job başlatıldı: Her akşam 20:00\'de rapor gönderilecek.');
}

module.exports = {
  startCronJobs,
  runDailyReport
};
