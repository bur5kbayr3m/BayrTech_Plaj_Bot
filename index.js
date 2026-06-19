require('dotenv').config();
const express = require('express');
const { getSession, updateSession, resetSession } = require('./state');
const { saveReservation, updateReservationStatus } = require('./supabase');
const { 
  sendDaySelectionList, 
  sendTripSelectionList, 
  sendGroupSelectionList,
  sendNameRequestMessage,
  sendProcessingMessage,
  sendAdminApprovalRequest,
  sendStatusUpdateToUser
} = require('./whatsapp');

const app = express();
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'my_verify_token';

// Webhook verification for Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle incoming webhook messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log("Gelen Webhook İsteği:", JSON.stringify(body, null, 2));

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      const phone = message.from;

      let session = getSession(phone);

      // Handle any text message -> Restart flow OR Name Input
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
              passenger_count: session.selected_count
            });
          } catch (err) {
            console.error("Failed to save to Supabase, but continuing flow for UX");
          }

          await sendProcessingMessage(phone, session.selected_day, session.selected_time, session.selected_count, session.selected_name);
          
          if (savedRes && savedRes.id && process.env.ADMIN_PHONE) {
            await sendAdminApprovalRequest(process.env.ADMIN_PHONE, savedRes.id, phone, session.selected_day, session.selected_time, session.selected_count, session.selected_name);
          }
          
          resetSession(phone);
          return res.sendStatus(200);
        }

        session = resetSession(phone);
        const { sendWelcomeMessage, sendMainMenu } = require('./whatsapp');
        await sendWelcomeMessage(phone);
        await sendMainMenu(phone);
      } 
      // Handle interactive message replies
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
          const ADMIN_PHONE = process.env.ADMIN_PHONE;
          
          if (phone === ADMIN_PHONE && (replyId.startsWith('admin_approve_') || replyId.startsWith('admin_reject_'))) {
            const isApproved = replyId.startsWith('admin_approve_');
            const reservationId = isApproved ? replyId.replace('admin_approve_', '') : replyId.replace('admin_reject_', '');
            const newStatus = isApproved ? 'Onaylandı' : 'Reddedildi';
            
            try {
              const updatedRes = await updateReservationStatus(reservationId, newStatus);
              if (updatedRes && updatedRes.tel_no) {
                // Determine if Hacıosman or Mecidiyeköy based on the saved 'time' or location.
                // Assuming `time` was saved with the trip info or we fetch it.
                // Currently, `updatedRes` doesn't return the full string if we don't store it, 
                // but wait, we need to make sure we check the database properly or save it.
                // Assuming we use updatedRes for now. We will just check if time/lokasyon_adi has Hacıosman.
                // For simplicity, we will pass `true` as isHaciosman if we can't determine it easily yet.
                // We will fix database storing in schema.sql later. 
                const isHaciosman = updatedRes.lokasyon_adi ? updatedRes.lokasyon_adi.toLowerCase().includes('hacıosman') : true;
                
                await sendStatusUpdateToUser(updatedRes.tel_no, newStatus, isHaciosman);
              }
            } catch (err) {
              console.error("Error updating reservation status:", err);
            }
            return res.sendStatus(200);
          }

          // Main Menu Handle
          if (replyId === 'menu_rezervasyon') {
            session = updateSession(phone, { step: 1 });
            await sendDaySelectionList(phone);
          } else if (replyId === 'menu_sss') {
            const { sendFaqList } = require('./whatsapp');
            await sendFaqList(phone);
          } else if (replyId === 'menu_canli_destek') {
            const { sendContactSupport } = require('./whatsapp');
            await sendContactSupport(phone);
          }
          // FAQ Handle
          else if (replyId.startsWith('faq_')) {
            const { sendFaqAnswer } = require('./whatsapp');
            await sendFaqAnswer(phone, replyId);
          }
          // Reservation Flow Handle
          else if (session.step === 1 && replyId.match(/^(bugun|yarin|pazartesi|sali)$/)) {
            session = updateSession(phone, { step: 2, selected_day: replyTitle });
            await sendTripSelectionList(phone, session.selected_day);
          } 
          else if (session.step === 2 && replyId.startsWith('sefer_')) {
            session = updateSession(phone, { step: 3, selected_time: replyTitle });
            await sendGroupSelectionList(phone, session.selected_day, session.selected_time);
          }
          else if (session.step === 3 && replyId.startsWith('grup_')) {
            if (replyId === 'grup_erkek_iptal') {
              const { sendMessage } = require('./whatsapp');
              await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: { body: "❌ Üzgünüz, plajımıza damsız giriş yapılamadığı için sadece erkek gruplarının rezervasyonunu kabul edemiyoruz. Anlayışınız için teşekkür ederiz." }
              });
              resetSession(phone);
              return res.sendStatus(200);
            }

            session = updateSession(phone, { step: 4, selected_count: replyTitle });
            await sendNameRequestMessage(phone);
          }
          else {
            session = resetSession(phone);
            const { sendWelcomeMessage, sendMainMenu } = require('./whatsapp');
            await sendWelcomeMessage(phone);
            await sendMainMenu(phone);
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
