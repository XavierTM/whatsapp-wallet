

const { waitForServer,  createRequester, createBranch, createContact, phoneNumber, createTextNotification, getLastInserted, } = require("./utils");
const chai = require('chai');
const casual = require("casual");
const { assert, expect } = chai;
const chaiSpies = require('chai-spies');
const whatsapp = require("../whatsapp");
const Account = require("../db/Account");
const { Paynow } = require('paynow');
const Payment = require("../db/Payment");
const Session = require("../Session");

chai.use(chaiSpies);

const requester = createRequester();

const CHECK_BALANCE_OPTION = 1;
const TOPUP_OPTION = 2;
const SEND_OPTION = 3;


suite('API tests', function() {

   this.beforeAll(async () => {
      await waitForServer();
   });

   this.beforeEach(() => {
      Session.clearSessions();
   });


   test("Registration", async () => {

      const wa_id = phoneNumber();
      const profile_name = casual.name;

      // setup spies
      chai.spy.restore();
      chai.spy.on(whatsapp, 'send', () => {});

      // initial message
      let notification = await createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // User's full name message
      const name = casual.name;
      notification = await createTextNotification({ profile_name, wa_id, text: name });

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
      let notification = await createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to select topup option
      notification = await createTextNotification({ profile_name, wa_id, text: TOPUP_OPTION });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide amount 
      const amount = casual.integer(10, 100);
      notification = await createTextNotification({ profile_name, wa_id, text: amount });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide mobile wallet
      const wallet = '077' + casual.integer(1000000, 9999999)
      notification = await createTextNotification({ profile_name, wa_id, text: wallet });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // send paynow webhook
      const lastPayment = await getLastInserted(Payment);
      const reference = lastPayment.id;

      const payload = {
         status: 'paid',
         reference,
      }

      const paynow = new Paynow(process.env.PAYNOW_ID, process.env.PAYNOW_KEY);
      payload.hash = paynow.generateHash(payload, process.env.PAYNOW_KEY);

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
      let notification = await createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to selct check baance option
      notification = await createTextNotification({ profile_name, wa_id, text: CHECK_BALANCE_OPTION });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // spy reports
      expect(whatsapp.send).to.have.been.called(2);
      
      const amount = account.balance.toFixed(2);
      const balanceMessage = args[1]
      assert.isAtLeast(balanceMessage.indexOf(amount), 0);

   });

   test("Send money", async () => {

      const wa_id = phoneNumber();
      const recipient_wa_id = phoneNumber();
      const profile_name = casual.name;

      // create accounts
      const amount = casual.integer(10, 100);

      let senderAccount = await Account.create({
         name: casual.name,
         phone: wa_id,
         balance: amount,
      });

      let recipientAccount = await Account.create({
         name: casual.name,
         phone: recipient_wa_id,
      });

      // setup spies
      chai.spy.restore();
      chai.spy.on(whatsapp, 'send', () => {});

      // initial message
      let notification = await createTextNotification({ profile_name, wa_id });
      let res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to select send money option
      notification = await createTextNotification({ profile_name, wa_id, text: SEND_OPTION });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide receiver account number
      notification = await createTextNotification({ profile_name, wa_id, text: recipient_wa_id });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide amount
      notification = await createTextNotification({ profile_name, wa_id, text: amount });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // Message to provide confirmation
      notification = await createTextNotification({ profile_name, wa_id, text: 1 });

      res = await requester
         .post('/api/webhooks/whatsapp')
         .send(notification);

      assert.equal(res.status, 200);

      // spy reports
      expect(whatsapp.send).to.have.been.called(6);
      
      // check db
      senderAccount = await Account.findByPk(senderAccount.id);
      assert.equal(senderAccount.balance, 0);

      recipientAccount = await Account.findByPk(recipientAccount.id);
      assert.equal(recipientAccount.balance, amount);

   });

   
   
});