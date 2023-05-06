const logger = require("./logger");


function status_500(err, res) {
   try { res.sendStatus(500); } catch {};
   logger.error(err);
}


module.exports = status_500;