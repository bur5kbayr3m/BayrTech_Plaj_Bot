require('dotenv').config();
const express = require('express');
const { getSession, updateSession, resetSession } = require('./state');
const { saveReservation, updateReservationStatus } = require('./supabase');
const { 
  sendDaySelectionList, 
  sendTripSelectionList, 
  sendPassengerCountList, 
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

      // Handle any text message -> Restart flow
      if (message.type === 'text') {
        session = resetSession(phone);
        await sendDaySelectionList(phone);
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
                await sendStatusUpdateToUser(updatedRes.tel_no, newStatus);
              }
            } catch (err) {
              console.error("Error updating reservation status:", err);
            }
            return res.sendStatus(200);
          }

          if (session.step === 1 && replyId.match(/^(bugun|yarin|pazartesi|sali)$/)) {
            session = updateSession(phone, { step: 2, selected_day: replyTitle });
            await sendTripSelectionList(phone, session.selected_day);
          } 
          else if (session.step === 2 && replyId.startsWith('sefer_')) {
            session = updateSession(phone, { step: 3, selected_time: replyTitle });
            await sendPassengerCountList(phone, session.selected_day, session.selected_time);
          }
          else if (session.step === 3 && replyId.startsWith('kisi_')) {
            const countStr = replyId.split('_')[1];
            const count = parseInt(countStr) || 6;
            
            session = updateSession(phone, { step: 4, selected_count: replyTitle });
            
            let savedRes = null;
            try {
              savedRes = await saveReservation({
                phone: phone,
                day: session.selected_day,
                time: session.selected_time,
                passenger_count: count
              });
            } catch (err) {
              console.error("Failed to save to Supabase, but continuing flow for UX");
            }

            await sendProcessingMessage(phone, session.selected_day, session.selected_time, session.selected_count);
            
            if (savedRes && savedRes.id && ADMIN_PHONE) {
              await sendAdminApprovalRequest(ADMIN_PHONE, savedRes.id, phone, session.selected_day, session.selected_time, session.selected_count);
            }
            
            resetSession(phone);
          }
          else {
            session = resetSession(phone);
            await sendDaySelectionList(phone);
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
