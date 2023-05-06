const capitalize = require("capitalize");
const Account = require("./db/Account");
const { Paynow } = require("paynow");
const Payment = require("./db/Payment");


const STATES = {
   MENU: 'menu',
   PROVIDING_NAME_FOR_REGISTRATION: 'providing-name-for-registration',
   PROVIDING_TOPUP_AMOUNT: 'providing-topup-amount',
   PROVIDING_MOBILE_WALLET: 'providing-mobile-wallet',
}


async function initialMessage(phone, profileName) {

   const account = await Account.findOne({ where: { phone }});

   let newState, response

   if (account) {
      response = `Hi *${profileName | capitalize.words(account.name)}*. What do you want to do today?\n\n1. Check your balance\n2. Topup account\n3. Transfer  money`;
      newState = STATES.MENU
   } else {
      response = `Hi *${profileName || 'User' }*. Let's create your account. Please provide your full legal name`;
      newState = STATES.PROVIDING_NAME_FOR_REGISTRATION
   }

   return [ newState, response ]

} 


async function nameProvisionResponse(phone, name) {

   if (name.split(' ').length < 2) {
      return [
         STATES.PROVIDING_NAME_FOR_REGISTRATION,
         'Invalid name format, provide your name again.',
      ]
   }

   const account = await Account.create({ name, phone });

   const text = `You account has been created successfully.\n\n*Name*: ${capitalize.words(name)}\n*Account No*: ${account.account_no}\n*Balance*: 0`;
   return [ undefined, text ]
}


async function balanceRequestResponse(phone) {
   const account = await Account.findOne({ where: { phone }})
   const text = `*Name*: ${capitalize.words(account.name)}\n*Account No*: ${account.account_no}\n*Balance*: ${account.balance.toFixed(2)}`;
   return [ undefined, text ]
}

async function topupRequestResponse() {
   const message = `How much do you want to topup with?`;
   return [ STATES.PROVIDING_TOPUP_AMOUNT, message ]
}


async function topupAmountProvisionResponse(amount) {

   // validate
   amount = parseFloat(amount) || 0;

   if (!amount) {
      return [
         STATES.PROVIDING_TOPUP_AMOUNT,
         'Invalid amount, try again',
      ]
   }

   return [
      STATES.PROVIDING_MOBILE_WALLET,
      'Provide your Ecocash phone number. Reply with 0 to use your Whatsapp number',
      {
         amount
      }
   ]

   
}


async function walletProvisionResponse(phone, wallet, sessionData) {

   // validate wallet
   if (wallet === "0")
      wallet = phone;

   if (wallet[0] !== '0')
      phone.replace('263', '0');

   const threeDigits = wallet.substring(0, 3);
   if ((threeDigits !== '077' && threeDigits !== '078') || wallet.length !== 10) {
      return [
         STATES.PROVIDING_MOBILE_WALLET,
         `Your number *${wallet}* is not a valid Ecocash wallet`
      ]
   }

   
   const { amount } = sessionData;

   // initial payment
   const account = await Account.findOne({ where: { phone } });

   const dbPayment = await Payment.create({
      amount,
      account: account.id,
   });

   const paynow = new Paynow(process.env.PAYNOW_ID, process.env.PAYNOW_KEY);
   paynow.resultUrl = `${process.env.SYSTEM_URL}/api/webhooks/paynow`

   const payment = paynow.createPayment(dbPayment.id, 'someone@example.com');
   payment.add('TOPUP', amount);

   await paynow.sendMobile(payment, wallet, 'ecocash')

   return [
      undefined,
      'Wait for the PIN prompt'
   ]
}


async function menuSelectionResponse(phone, option, profileName) {


   switch (option) {
      case "1":
         return await balanceRequestResponse(phone);

      case "2":
         return await topupRequestResponse();

      case "3":
         return await transferRequestResponse()
      
      default:
         return await initialMessage(phone, profileName)

   }

}


function processor(_, phone, state, payload, sessionData) {

   const { message, profileName } = payload;

   switch (state) {
      case STATES.MENU:
         return menuSelectionResponse(phone, message, profileName);
      
      case STATES.PROVIDING_NAME_FOR_REGISTRATION:
         return nameProvisionResponse(phone, message)

      case STATES.PROVIDING_TOPUP_AMOUNT:
         return topupAmountProvisionResponse(message);

      case STATES.PROVIDING_MOBILE_WALLET:
         return walletProvisionResponse(phone, message, sessionData)
   
      default:
         return initialMessage(phone, profileName)
   }
}


module.exports = processor;