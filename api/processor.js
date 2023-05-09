const capitalize = require("capitalize");
const Account = require("./db/Account");
const { Paynow } = require("paynow");
const Payment = require("./db/Payment");
const whatsapp = require("./whatsapp");
const logger = require("./logger");


const STATES = {
   MENU: 'menu',
   PROVIDING_NAME_FOR_REGISTRATION: 'providing-name-for-registration',
   PROVIDING_TOPUP_AMOUNT: 'providing-topup-amount',
   PROVIDING_MOBILE_WALLET: 'providing-mobile-wallet',
   PROVIDING_RECIPIENT_WALLET: 'providing-recepient-wallet',
   PROVIDING_TRANSFER_AMOUNT: 'providing-transfer-amount',
   PROVIDING_TRANSFER_CONFIRMATION: 'providing-transfer-confirmation',
   PROVIDING_CONTINUE_CONFIRMATION: 'providing-continuation-confirmation',
}

const CONTINUE_TEXT = '\n\n-----------------\nDo you want to do something else\n\n1. Yes\n2. No';


async function initialMessage(phone, profileName) {

   const account = await Account.findOne({ where: { phone }});

   let newState, response

   if (account) {
      response = `Hi *${profileName || capitalize.words(account.name)}*. What do you want to do today?\n\n1. Check your balance\n2. Topup account\n3. Transfer  money\n4. Support session.\n\nYou can cancel your request at any point by sending *.cancel*`;
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

   const text = `Your account has been created successfully.\n\n*Name*: ${capitalize.words(name)}\n*Account No*: ${account.account_number}\n*Balance*: 0`;
   return [ STATES.PROVIDING_CONTINUE_CONFIRMATION, text ]
}


async function balanceRequestResponse(phone) {
   const account = await Account.findOne({ where: { phone }})
   const text = `*Name*: ${capitalize.words(account.name)}\n*Account No*: ${account.account_number}\n*Balance*: ${account.balance.toFixed(2)}`;
   return [ STATES.PROVIDING_CONTINUE_CONFIRMATION, text ]
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
      STATES.PROVIDING_CONTINUE_CONFIRMATION,
      'Wait for the PIN prompt'
   ]
}


async function transferRequestResponse() {
   const text = 'Provide account number / or phone number of the person you want to send money to';
   return [ STATES.PROVIDING_RECIPIENT_WALLET, text ]
}

function endSessionRequestResponse() {
   return [
      undefined,
      "Your session has ended. Good bye",
   ];
}


function supportContactRequestResponse() {
   return [
      STATES.PROVIDING_CONTINUE_CONFIRMATION,
      'Contact the numbers below for support\n\n+263719228997\n+263715919598'
   ]
}


function menuSelectionResponse(phone, option, profileName) {

   switch (option) {
      case "1":
         return balanceRequestResponse(phone);

      case "2":
         return topupRequestResponse();

      case "3":
         return transferRequestResponse();

      case "4":
         return supportContactRequestResponse();
      
      default:
         return initialMessage(phone, profileName)

   }

}

async function recipientProvisionResponse(wallet) {
   
   // validate
   const where = {};

   if (wallet.length === 6) {
      where.wallet = wallet;
   } else {
      if (wallet[0] === '0')
         wallet = wallet.replace('0', '263');
      where.phone = wallet
   }

   const account = await Account.findOne({ where });

   if (!account) {
      return [
         STATES.PROVIDING_RECIPIENT_WALLET,
         `Invalid phone number or account number. Try again`
      ]
   }

   return [
      STATES.PROVIDING_TRANSFER_AMOUNT,
      `How much money do you want to transfer?`,
      { recipient: account.id }
   ]
}


async function transferAmountProvisionResponse(phone, amount, sessionData) {

   // validate amount
   amount = parseFloat(amount) || 0

   if (!amount) {
      return [
         STATES.PROVIDING_TRANSFER_AMOUNT,
         'Please provide a valid amount'
      ]
   }

   const senderAccount = await Account.findOne({ where: { phone }});

   if (senderAccount.balance < amount) {
      return [
         STATES.PROVIDING_TRANSFER_AMOUNT,
         `Insufficient funds. You can send up to *${senderAccount.balance.toFixed(2)}*. Try again`
      ]
   }

   const recipientAccount = await Account.findOne({ where: { id: sessionData.recipient }});

   return [
      STATES.PROVIDING_TRANSFER_CONFIRMATION,
      `Transferring *${amount.toFixed(2)}* to *${capitalize.words(recipientAccount.name)}*.\n\n1. Confirm\n2. Cancel`,
      { amount }
   ]

}

async function transferConfirmationProvisionResponse(phone, confirmation, sessionData) {

   // check confirmation

   if (confirmation !== "1") {
      return [
         STATES.PROVIDING_CONTINUE_CONFIRMATION,
         'You cancelled the transaction',
      ]
   }

   // transfer
   const senderAccount = await Account.findOne({ where: { phone }});
   const { recipient, amount } = sessionData;
   const recipientAccount = await Account.findByPk(recipient);

   recipientAccount.balance += amount;
   await recipientAccount.save();

   senderAccount.balance -= amount;
   await senderAccount.save();

   // notify receiver
   const text = `You have received *${amount.toFixed(2)}* from *${capitalize.words(senderAccount.name)}*.  Your new balance is *${recipientAccount.balance.toFixed(2)}*`;

   try {
      await whatsapp.send(recipientAccount.phone, text);
   } catch (err) {
      logger.error(err);
   }

   return [
      STATES.PROVIDING_CONTINUE_CONFIRMATION,
      `Successful transferred *${amount.toFixed(2)}* to *${capitalize.words(recipientAccount.name)}*. Your new balance is *${senderAccount.balance.toFixed(2)}*`
   ]

}

function continuationConfirmationProvisionResponse(phone, message) {

   if (message === '1') {
      return menuSelectionResponse(phone, null)
   }

   return endSessionRequestResponse();
}


async function processor(_, phone, state, payload, sessionData) {

   const { message, profileName } = payload;
   let result;

   if (payload === '.cancel') {
      result = [
         STATES.PROVIDING_CONTINUE_CONFIRMATION,
         'You cancelled your request.'
      ]
   } else {
      switch (state) {
         case STATES.MENU:
            result = await menuSelectionResponse(phone, message, profileName);
            break;
         
         case STATES.PROVIDING_NAME_FOR_REGISTRATION:
            result = await nameProvisionResponse(phone, message);
            break;
   
         case STATES.PROVIDING_TOPUP_AMOUNT:
            result = await topupAmountProvisionResponse(message);
            break;
   
         case STATES.PROVIDING_MOBILE_WALLET:
            result = await walletProvisionResponse(phone, message, sessionData);
            break;
         
         case STATES.PROVIDING_RECIPIENT_WALLET:
            result = await recipientProvisionResponse(message)  
            break;
   
         case STATES.PROVIDING_TRANSFER_AMOUNT:
            result = await transferAmountProvisionResponse(phone, message, sessionData)
            break;
   
         case STATES.PROVIDING_TRANSFER_CONFIRMATION:
            result = await transferConfirmationProvisionResponse(phone, message, sessionData)
            break;
   
         case STATES.PROVIDING_CONTINUE_CONFIRMATION:
            result = await continuationConfirmationProvisionResponse(phone, message);
            break;
   
         default:
            result = await initialMessage(phone, profileName)
            break;
      }
   }

   



   let [ newState, response, sessionDataUpdates  ] = result;

   if (newState === STATES.PROVIDING_CONTINUE_CONFIRMATION)
      response = `${response}${CONTINUE_TEXT}`;


   return [ newState, response, sessionDataUpdates ];

}


module.exports = processor;