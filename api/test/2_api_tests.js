

const { waitForServer,  createRequester, createBranch, createContact, phoneNumber, createTextNotification, getLastInserted, } = require("./utils");
const chai = require('chai');
const casual = require("casual");
const { assert, expect } = chai;
const chaiSpies = require('chai-spies');
const whatsapp = require("../whatsapp");
const Account = require("../db/Account");
const { Paynow } = require('paynow');

chai.use(chaiSpies);

const requester = createRequester();

const CHECK_BALANCE_OPTION = 1;
const TOPUP_OPTION = 2;
const SEND_OPTION = 3;


suite('API tests', function() {

   this.beforeAll(async () => {
      await waitForServer();
   });


   test("Registration", async () => {

      const wa_id = phoneNumber();
      const profile_name = casual.name;

      // setup spies
      chai.spy.restore();
      chai.spy.on(whatsapp, 'send', () => {});

      // initial message
      let notification = createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // User's full name message
      const name = casual.name;
      notification = createTextNotification({ profile_name, wa_id, text: name });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // spy reports
      expect(whatsapp.send).to.have.been.called(2);

      // check db
      const account = await getLastInserted(Account);
      assert.isObject(account);

      assert.equal(account.name, name);
      assert.equal(account.phone, wa_id);

   });

   test("Topup", async () => {

      const wa_id = phoneNumber();
      const profile_name = casual.name;

      // create account
      const name = casual.name;
      let account = await Account.create({
         name,
         phone: wa_id,
      });

      // setup spies
      chai.spy.restore();
      chai.spy.on(whatsapp, 'send', () => {});
      chai.spy.on(Paynow.prototype, 'sendMobile', () => {});     

      // initial message
      let notification = createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to select check balance option
      notification = createTextNotification({ profile_name, wa_id, text: TOPUP_OPTION });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide amount 
      const amount = casual.integer(10, 100);
      notification = createTextNotification({ profile_name, wa_id, text: amount });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide mobile wallet
      notification = createTextNotification({ profile_name, wa_id, text: phoneNumber() });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // send paynow webhook
      const payload = {
         status: 'paid',
      }

      const paynow = new Paynow(process.env.PAYNOW_ID, process.env.PAYNOW_KEY);
      payload.hash = paynow.generateHash(data, process.env.PAYNOW_KEY);

      res = await requester
         .post('/api/webhooks/paynow')
         .send(payload);

      assert.equal(res.status, 200);

      // spy reports
      expect(whatsapp.send).to.have.been.called(5);
      expect(Paynow.prototype.sendMobile).to.have.been.called(1);

      // check db
      account = await Account.findByPk(account.id);
      assert.equal(account.balance, amount);

   });

   test("Check balance", async () => {

      const wa_id = phoneNumber();
      const profile_name = casual.name;

      // create account
      const name = casual.name;
      const account = await Account.create({
         name,
         phone: wa_id,
         balance: casual.integer(10, 100)
      });

      // setup spies
      let args;

      chai.spy.restore();
      chai.spy.on(whatsapp, 'send', (..._args ) => args = _args);

      // initial message
      let notification = createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to selct check baance option
      notification = createTextNotification({ profile_name, wa_id, text: CHECK_BALANCE_OPTION });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // spy reports
      expect(whatsapp.send).to.have.been.called(2);
      
      const amount = account.amount.toFixed(2);
      assert.isAtLeast(balanceMessage.indexOf(amount), 0);

   });

   test("Send money", async () => {

      const wa_id = phoneNumber();
      const recipient_wa_id = phoneNumber();
      const profile_name = casual.name;

      // create accounts
      const amount = casual.integer(10, 100);

      const senderAccount = await Account.create({
         name: casual.name,
         phone: wa_id,
         balance: amount,
      });

      const recipientAccount = await Account.create({
         name: casual.name,
         phone: recipient_wa_id,
      });

      // setup spies
      chai.spy.restore();
      chai.spy.on(whatsapp, 'send', () => {});
      chai.spy.on(whatsapp, 'sendTemplateMessage', () => {});

      // initial message
      let notification = createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to select send money option
      notification = createTextNotification({ profile_name, wa_id, text: SEND_OPTION });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide receiver account number
      notification = createTextNotification({ profile_name, wa_id, text: recipient_wa_id });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide amount
      notification = createTextNotification({ profile_name, wa_id, text: amount });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // spy reports
      expect(whatsapp.send).to.have.been.called(4);
      expect(whatsapp.sendTemplateMessage).to.have.been.called(1);
      
      // check db
      senderAccount = await Account.findByPk(senderAccount.id);
      assert.equal(senderAccount.balance, 0);

      recipientAccount = await Account.findByPk(recipientAccount.id);
      assert.equal(recipientAccount.balance, amount);

   });

   
   
});