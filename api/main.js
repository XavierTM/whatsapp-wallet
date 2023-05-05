
console.clear();

require('dotenv').config();
require('./env');

const express = require('express');
const { init: initDB } = require('./db');
const morgan = require('morgan');


const app = express();

// middlewares
if (process.env.NODE_ENV !== 'test')
   app.use(morgan('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes



// initialization
const PORT = process.env.PORT;

initDB().then(() => {
   app.listen(PORT, async () => {
      console.log("Server started @ PORT", PORT);   
   });
});