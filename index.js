require('dotenv').config();
const express = require('express');
const { getSession, updateSession, resetSession } = require('./state');
const { saveReservation, updateReservationStatus } = require('./supabase');
const { 
  sendLanguageSelection,
  sendWelcomeMessage,
  sendMainMenu,
  sendDaySelectionList, 
  sendTripSelectionList, 
  sendGroupSelectionList,
  sendNameRequestMessage,
  sendProcessingMessage,
  sendAdminApprovalRequest,
  sendStatusUpdateToUser,
  sendFaqList,
  sendFaqAnswer,
  sendContactSupport,
  sendMessage
} = require('./whatsapp');

const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const pdfDir = path.join(__dirname, 'public_pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir);
}
app.use('/public_pdfs', express.static(pdfDir));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'my_verify_token';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      const phone = message.from;

      let session = getSession(phone);
      
      const { sendAdminMainMenu, handleAdminFlow, startAdminReservationFlow } = require('./admin');
      
      // Admin Interception
      const isAdmin = process.env.ADMIN_PHONE && phone.includes(process.env.ADMIN_PHONE.trim().replace('+', '').replace(/^0/, ''));
      
      if (session.admin_step > 0) {
        await handleAdminFlow(phone, message, session);
        return res.sendStatus(200);
      }

      if (message.type === 'text') {
        const textLower = message.text.body.toLowerCase().trim();
        
        if (isAdmin && (textLower === 'ayarlar' || textLower === 'admin')) {
          updateSession(phone, { admin_step: 1 });
          await sendAdminMainMenu(phone);
          return res.sendStatus(200);
        }
        
        if (isAdmin && textLower === 'rezervasyon') {
          await startAdminReservationFlow(phone);
          return res.sendStatus(200);
        }

        if (session && session.step === 4) {
          const nameInput = message.text.body;
          session = updateSession(phone, { step: 5, selected_name: nameInput });
          
          let savedRes = null;
          try {
            savedRes = await saveReservation({
              phone: phone,
              name: session.selected_name,
              day: session.selected_day,
              time: session.selected_time,
              passenger_count: session.selected_count_num || 1
            });
          } catch (err) {
            console.error("Failed to save to Supabase, but continuing flow for UX");
          }

          await sendProcessingMessage(phone, session.selected_day, session.selected_time, session.selected_count, session.selected_name, session.lang);
          
          if (savedRes && savedRes.id && process.env.ADMIN_PHONE) {
            let adminPhone = process.env.ADMIN_PHONE.trim().replace('+', '');
            if (adminPhone.startsWith('0')) adminPhone = '90' + adminPhone.substring(1);
            else if (!adminPhone.startsWith('90') && adminPhone.length > 0) adminPhone = '90' + adminPhone;

            try {
              await sendAdminApprovalRequest(adminPhone, savedRes.id, phone, session.selected_day, session.selected_time, session.selected_count, session.selected_name);
            } catch (adminErr) {
              console.error("Admin mesajı gönderilemedi:", adminErr.message || adminErr);
            }
          }
          
          resetSession(phone);
          return res.sendStatus(200);
        }

        // New connection or text out of flow: Ask for language
        session = resetSession(phone);
        await sendLanguageSelection(phone);
      } 
      else if (message.type === 'interactive') {
        const interactive = message.interactive;
        
        let replyId = null;
        let replyTitle = null;

        if (interactive.type === 'list_reply') {
          replyId = interactive.list_reply.id;
          replyTitle = interactive.list_reply.title;
        } else if (interactive.type === 'button_reply') {
          replyId = interactive.button_reply.id;
          replyTitle = interactive.button_reply.title;
        }

        if (replyId) {
          let adminPhoneNorm = process.env.ADMIN_PHONE || '';
          adminPhoneNorm = adminPhoneNorm.trim().replace('+', '');
          if (adminPhoneNorm.startsWith('0')) adminPhoneNorm = '90' + adminPhoneNorm.substring(1);
          else if (!adminPhoneNorm.startsWith('90') && adminPhoneNorm.length > 0) adminPhoneNorm = '90' + adminPhoneNorm;
          
          if (replyId === 'cancel_req') {
            const { getLatestReservation } = require('./supabase');
            const latest = await getLatestReservation(phone);
            
            if (latest && latest.durum === 'Onaylandı') {
              const { sendCancelRequestToAdmin } = require('./whatsapp');
              await sendCancelRequestToAdmin(adminPhoneNorm, latest.id, phone, latest);
              
              const userSession = getSession(phone);
              const { sendMessage } = require('./whatsapp');
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: { body: userSession.lang === 'en' ? "⏳ Your cancellation request has been sent to the authority. You will be notified once approved." : "⏳ İptal talebiniz yetkiliye iletildi. Onaylandığında size bilgi verilecektir." }
              });
            } else {
              const userSession = getSession(phone);
              const { sendMessage } = require('./whatsapp');
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: { body: userSession.lang === 'en' ? "❌ This reservation has already been cancelled or processed." : "❌ Bu rezervasyon zaten iptal edilmiş veya işlemi tamamlanmış durumda." }
              });
            }
            return res.sendStatus(200);
          }
          
          if (phone === adminPhoneNorm && (replyId.startsWith('admin_cancel_app_') || replyId.startsWith('admin_cancel_rej_'))) {
            const isApproved = replyId.startsWith('admin_cancel_app_');
            const reservationId = isApproved ? replyId.replace('admin_cancel_app_', '') : replyId.replace('admin_cancel_rej_', '');
            
            const { cancelReservation } = require('./supabase');
            const { sendMessage } = require('./whatsapp');
            
            if (isApproved) {
              try {
                await cancelReservation(reservationId);
                // We need to fetch user phone to notify them, wait, reservation has it?
                const { getLatestReservation } = require('./supabase');
                // Actually cancelReservation doesn't return the phone. Let me just use getLatestReservation or we can assume we know it.
                // I will add a quick query here
                const { supabase } = require('./supabase');
                const { data: resData } = await supabase.from('reservations').select('tel_no').eq('id', reservationId).single();
                if (resData) {
                  const customerSession = getSession(resData.tel_no);
                  await sendMessage({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: resData.tel_no,
                    type: "text",
                    text: { body: customerSession.lang === 'en' ? "✅ Your reservation has been successfully cancelled." : "✅ Rezervasyonunuz başarıyla iptal edilmiştir." }
                  });
                }
                await sendMessage({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: adminPhoneNorm,
                  type: "text",
                  text: { body: "✅ İptal işlemi onaylandı, kontenjan iade edildi ve müşteriye bilgi verildi." }
                });
              } catch(e) { console.error(e); }
            } else {
              await sendMessage({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: adminPhoneNorm,
                  type: "text",
                  text: { body: "❌ İptal işlemi reddedildi." }
              });
            }
            return res.sendStatus(200);
          }

          if (phone === adminPhoneNorm && replyId.startsWith('add_cap_')) {
            const seferId = replyId.replace('add_cap_', '');
            const { increaseTripCapacity } = require('./supabase');
            const { sendMessage } = require('./whatsapp');
            try {
              await increaseTripCapacity(seferId, 15);
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: adminPhoneNorm,
                type: "text",
                text: { body: "✅ Kapasite başarıyla +15 artırıldı. Bekleyen talepleri onaylayabilirsiniz!" }
              });
            } catch (err) {
              console.error(err);
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: adminPhoneNorm,
                type: "text",
                text: { body: "❌ Kapasite artırılırken bir hata oluştu." }
              });
            }
            return res.sendStatus(200);
          }

          if (phone === adminPhoneNorm && (replyId.startsWith('admin_approve_') || replyId.startsWith('admin_reject_') || replyId.startsWith('admin_full_'))) {
            const isApproved = replyId.startsWith('admin_approve_');
            const isFull = replyId.startsWith('admin_full_');
            const reservationId = isApproved ? replyId.replace('admin_approve_', '') : (isFull ? replyId.replace('admin_full_', '') : replyId.replace('admin_reject_', ''));
            const newStatus = isApproved ? 'Onaylandı' : 'Reddedildi';
            
            try {
              const updatedRes = await updateReservationStatus(reservationId, newStatus);
              if (updatedRes && updatedRes.tel_no) {
                const kalkisYeri = updatedRes.trips && updatedRes.trips.kalkis_yeri ? updatedRes.trips.kalkis_yeri.toLowerCase() : '';
                const isHaciosman = kalkisYeri.includes('hacıosman') || kalkisYeri.includes('haciosman');
                
                const customerSession = getSession(updatedRes.tel_no);
                await sendStatusUpdateToUser(updatedRes.tel_no, isFull ? 'Dolu' : newStatus, isHaciosman, customerSession.lang, updatedRes);
                
                let feedbackText = isApproved 
                  ? "✅ Rezervasyon onaylandı ve müşteriye bilgilendirme mesajı gönderildi."
                  : "❌ Rezervasyon reddedildi ve müşteriye iptal bilgisi verildi.";
                
                if (isFull) {
                  feedbackText = "✅ Müşteriye kapasitenin dolduğu bilgisi ve yeniden seçim yapması için menüye dönüş butonu gönderildi.";
                }
                
                await sendMessage({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: adminPhoneNorm,
                  type: "text",
                  text: { body: feedbackText }
                });

                // Doluluk kontrolü (Sadece onaylandığında)
                if (isApproved && updatedRes.sefer_id) {
                  const { getTripCapacity } = require('./supabase');
                  const trip = await getTripCapacity(updatedRes.sefer_id);
                  if (trip && trip.rezerve_edilen >= trip.toplam_kapasite) {
                    const alertMsg = `🚨 *DİKKAT: KAPASİTE DOLDU!* 🚨\n\n${trip.tarih} ${trip.saat} ${trip.kalkis_yeri} seferi TAMAMEN DOLDU (Kapasite: ${trip.toplam_kapasite}/${trip.toplam_kapasite})!\n\nEk araç tanımlamak (Kapasiteyi +15 artırmak) ister misiniz?`;
                    await sendMessage({
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      to: adminPhoneNorm,
                      type: "interactive",
                      interactive: {
                        type: "button",
                        body: { text: alertMsg },
                        action: {
                          buttons: [
                            { type: "reply", reply: { id: `add_cap_${updatedRes.sefer_id}`, title: "➕ +15 Artır" } }
                          ]
                        }
                      }
                    });
                  } else if (trip && trip.rezerve_edilen === trip.toplam_kapasite - 1) {
                    const alertMsg = `⚠️ *UYARI: SON 1 KİŞİLİK YER KALDI!* ⚠️\n\n${trip.tarih} ${trip.saat} ${trip.kalkis_yeri} seferinin dolmasına sadece 1 kişi kaldı (Kapasite: ${trip.rezerve_edilen}/${trip.toplam_kapasite})!`;
                    await sendMessage({
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      to: adminPhoneNorm,
                      type: "text",
                      text: { body: alertMsg }
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Error updating reservation status:", err);
              const { sendMessage } = require('./whatsapp');
              let errMsg = "❌ Onay işlemi sırasında bir hata oluştu.";
              const errStr = JSON.stringify(err);
              if (errStr.includes('23514') || errStr.includes('capacity') || (err.message && err.message.includes('capacity'))) {
                errMsg = "❌ Onay başarısız! Bu seferin araç kapasitesi dolmuştur. Lütfen ⚠️ Dolu (Yönlendir) butonunu kullanın veya kapasiteyi artırın.";
              } else if (errStr.includes('131047') || errStr.includes('24 hour') || (err.response && err.response.data && JSON.stringify(err.response.data).includes('131047'))) {
                errMsg = "⚠️ Rezervasyon ONAYLANDI ancak müşterinin (+" + (updatedRes ? updatedRes.tel_no : "Bilinmiyor") + ") son mesajının üzerinden 24 saat geçtiği için WhatsApp API kuralları gereği otomatik SMS iletilemedi. Lütfen müşteriye normal WhatsApp üzerinden ulaşıp bilgi veriniz.";
              } else if (errStr.includes('131026') || errStr.includes('invalid') || errStr.includes('undeliverable')) {
                errMsg = "⚠️ Rezervasyon ONAYLANDI ancak müşterinin (+" + (updatedRes ? updatedRes.tel_no : "Bilinmiyor") + ") numarası WhatsApp'ta bulunamadığı/geçersiz olduğu için mesaj iletilemedi. Lütfen manuel ulaşmayı deneyin.";
              }
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: adminPhoneNorm,
                type: "text",
                text: { body: errMsg }
              }).catch(e => console.error("Error sending admin fail msg:", e));
            }
            return res.sendStatus(200);
          }

          // Language Selection Handle
          if (replyId === 'lang_tr' || replyId === 'lang_en') {
            const lang = replyId === 'lang_en' ? 'en' : 'tr';
            session = updateSession(phone, { lang: lang });
            await sendWelcomeMessage(phone, session.lang);
            await sendMainMenu(phone, session.lang);
          }
          // Main Menu Handle
          else if (replyId === 'menu_rezervasyon') {
            session = updateSession(phone, { step: 1 });
            await sendDaySelectionList(phone, session.lang);
          } else if (replyId === 'menu_sss') {
            await sendFaqList(phone, session.lang);
          } else if (replyId === 'menu_canli_destek') {
            await sendContactSupport(phone, session.lang);
          }
          // FAQ Handle
          else if (replyId.startsWith('faq_')) {
            await sendFaqAnswer(phone, replyId, session.lang);
          }
          // Main Menu Return
          else if (replyId === 'menu_ana') {
            session = resetSession(phone);
            await sendMainMenu(phone, session.lang);
          }
          // Reservation Flow Handle
          else if (replyId.startsWith('day_')) {
            session = updateSession(phone, { step: 2, selected_day: replyTitle });
            await sendTripSelectionList(phone, session.selected_day, session.lang);
          } 
          else if (replyId.startsWith('sefer_')) {
            if (!session.selected_day) {
              session = resetSession(phone);
              await sendLanguageSelection(phone);
              return res.sendStatus(200);
            }
            session = updateSession(phone, { step: 3, selected_time: replyTitle });
            await sendGroupSelectionList(phone, session.selected_day, session.selected_time, session.lang);
          }
          else if (replyId.startsWith('grup_')) {
            if (session.step === 4) return res.sendStatus(200); // Ignore duplicate click
            if (!session.selected_day || !session.selected_time) {
              session = resetSession(phone);
              await sendLanguageSelection(phone);
              return res.sendStatus(200);
            }

            if (replyId === 'grup_erkek_iptal') {
              const errMsg = session.lang === 'en' 
                ? "❌ Sorry, entry without a female companion is not allowed. We cannot accept reservations for all-male groups. Thank you for your understanding."
                : "❌ Üzgünüz, plajımıza damsız giriş yapılamadığı için sadece erkek gruplarının rezervasyonunu kabul edemiyoruz. Anlayışınız için teşekkür ederiz.";
              
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: { body: errMsg }
              });
              resetSession(phone);
              return res.sendStatus(200);
            }

            const countNum = parseInt(replyId.split('_').pop()) || 1;
            session = updateSession(phone, { step: 4, selected_count: replyTitle, selected_count_num: countNum });
            await sendNameRequestMessage(phone, session.lang);
          }
          else {
            session = resetSession(phone);
            await sendLanguageSelection(phone);
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.sendStatus(500);
  }
});

const { startCronJobs } = require('./cron');

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startCronJobs();
});
