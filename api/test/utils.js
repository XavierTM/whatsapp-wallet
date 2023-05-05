const { default: axios } = require("axios");
const crypto = require('crypto');
const fs = require('fs/promises');
const dummyjson = require("dummy-json");
const chai = require('chai');
const chaiHttp = require("chai-http");
const casual = require("casual");

chai.use(chaiHttp);

async function waitForServer(url = `http://localhost:${process.env.PORT}`) {

   let success = false;

   while (!success) {
      try {
         await axios.get(url);
         success = true;
      } catch (err) {
         if (err.code !== 'ECONNREFUSED')
            success = true;
      }
   }
}


async function createTextNotification({
   profile_name,
   wa_id,
   text='Hi',
}) {

   const mockdata = {
      profile_name,
      wa_id,
      text,
   }

   let json = await fs.readFile(`${__dirname}/assets/text_message_template.json`, 'utf-8');
   json = dummyjson.parse(json, { mockdata });

   return JSON.parse(json);

}


function createRequester() {
   return chai.request(`http://localhost:${process.env.PORT}`).keepOpen();
}


function createSha256Signature(payload, waClientSecret) {
   const json = JSON.stringify(payload);
   return crypto.createHmac('sha256', waClientSecret).update(json).digest('hex');
}

function phoneNumber() {
   return '263' + casual.phone.replaceAll('-', '');
}

function getLastInserted(Model) {
   return Model.findOne({ order: [[ 'id', 'ASC' ]]});
}

module.exports = {
   createRequester,
   createSha256Signature,
   createTextNotification,
   getLastInserted,
   phoneNumber,
   waitForServer,
}