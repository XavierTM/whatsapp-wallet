const { Router } = require("express");
const status_500 = require('./status_500');
const Session = require("./Session");
const whatsapp = require('./whatsapp');
const { sequelize } = require("./db");
const Payment = require("./db/Payment");
const Account = require("./db/Account");
const { Paynow } = require("paynow");

const webhooks = Router();

webhooks.post('/whatsapp', async (req, res) => {

   try {

      const { WaId, ProfileName, Body } = req.body;
      
      const payload = {
         message: Body,
         profileName: ProfileName,
      }

      const response = await Session.processRequest(undefined, WaId, payload);
      await whatsapp.send(WaId, response);
      
      res.send();
   } catch (err) {
      status_500(err, res);
   }
});

webhooks.post('/paynow', async (req, res) => {

   try {
      
      // check status
      let { status, hash, reference: id } = req.body;
      status = String(status).toLowerCase();

      if (process.env.FAKE_PAYNOW_TRANSACTIONS)
         status = 'paid';

      if (status !== 'paid')
         return res.sendStatus(200);

      if (typeof hash !== 'string')
         return res.status(400).send('Hash required');

      // verify hash
      const paynow = new Paynow(process.env.PAYNOW_ID, process.env.PAYNOW_KEY);
      const hashIsValid = paynow.verifyHash(req.body);
      
      if (!hashIsValid)
         return res.status(400).send('invalid hash');

      const transaction = await sequelize.transaction();

      try {

         // retrieve payment
         const payment = await Payment.findByPk(id, { transaction });

         // update balance
         const account = await Account.findByPk(payment.account, { transaction });
         account.balance += payment.amount;
         await account.save({ transaction });
        
         // delete payment
         await payment.destroy({ transaction });

         // notify user
         const text = `Your payment was successful. Your new balance is ${account.balance.toFixed(2)}`;
         await whatsapp.send(account.phone, text);

         // commit transaction
         await transaction.commit();
         
         res.send();

      } catch (err) {
         try { await transaction.rollback() } catch {};
         throw err;
      }
      
   } catch (err) {
      status_500(err, res);
   }
});


module.exports = webhooks;