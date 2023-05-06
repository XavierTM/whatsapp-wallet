


function presenceChecker(keys=[]) {
   keys.forEach(key => {

      if (!process.env[key]) {
         throw new Error(`Environment variable '${key}' is essential`);
      }
   });
}

const BASE_KEYS = [
   'PORT',
   'NODE_ENV',
   'PAYNOW_ID',
   'PAYNOW_KEY',
   'TWILIO_ID',
   'TWILIO_KEY',
   'WA_ID',
   'SYSTEM_URL'
];

const CONDITIONAL_KEYS = [];

// conditional logic

presenceChecker(CONDITIONAL_KEYS);
presenceChecker(BASE_KEYS);
