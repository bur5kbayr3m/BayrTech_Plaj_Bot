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

const app = express();
app.use(express.json());

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

      if (message.type === 'text') {
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

          if (phone === adminPhoneNorm && (replyId.startsWith('admin_approve_') || replyId.startsWith('admin_reject_'))) {
            const isApproved = replyId.startsWith('admin_approve_');
            const reservationId = isApproved ? replyId.replace('admin_approve_', '') : replyId.replace('admin_reject_', '');
            const newStatus = isApproved ? 'Onaylandı' : 'Reddedildi';
            
            try {
              const updatedRes = await updateReservationStatus(reservationId, newStatus);
              if (updatedRes && updatedRes.tel_no) {
                const isHaciosman = updatedRes.lokasyon_adi ? updatedRes.lokasyon_adi.toLowerCase().includes('hacıosman') : true;
                
                // Fetch the customer's language to send status
                const customerSession = getSession(updatedRes.tel_no);
                await sendStatusUpdateToUser(updatedRes.tel_no, newStatus, isHaciosman, customerSession.lang);
                
                // Send feedback back to the admin
                const feedbackText = isApproved 
                  ? "✅ Rezervasyon onaylandı ve müşteriye bilgilendirme mesajı (konum dahil) gönderildi."
                  : "❌ Rezervasyon reddedildi ve müşteriye iptal bilgisi verildi.";
                
                await sendMessage({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: adminPhoneNorm,
                  type: "text",
                  text: { body: feedbackText }
                });
              }
            } catch (err) {
              console.error("Error updating reservation status:", err);
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
          else if (session.step === 1 && replyId.startsWith('day_')) {
            session = updateSession(phone, { step: 2, selected_day: replyTitle });
            await sendTripSelectionList(phone, session.selected_day, session.lang);
          } 
          else if (session.step === 2 && replyId.startsWith('sefer_')) {
            session = updateSession(phone, { step: 3, selected_time: replyTitle });
            await sendGroupSelectionList(phone, session.selected_day, session.selected_time, session.lang);
          }
          else if (session.step === 3 && replyId.startsWith('grup_')) {
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
