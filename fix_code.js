const fs = require('fs');

let wa = fs.readFileSync('whatsapp.js', 'utf8');
wa = wa.replace(/return sendMessage\(phone, data\);/g, 'return sendMessage(data);');
fs.writeFileSync('whatsapp.js', wa);

let ix = fs.readFileSync('index.js', 'utf8');
ix = ix.replace(
  `await sendMessage(phone, {
                type: "text"`,
  `await sendMessage({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone,
                type: "text"`
);
fs.writeFileSync('index.js', ix);

console.log("Fixed files.");
