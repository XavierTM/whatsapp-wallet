

const createTwilioClient = require('twilio');


function send(recipient, text) {

   const message = {
      to: `whatsapp:+${recipient}`,
      from: `whatsapp:${process.env.WA_ID}`,
      body: text,
   }

   return client.messages.create(message);
}

function sendTemplateMessage(recipient, template_id, variables) {

}

const client = createTwilioClient(process.env.TWILIO_ID, process.env.TWILIO_KEY);

const whatsapp = {
   send,
   sendTemplateMessage,
};


module.exports = whatsapp;