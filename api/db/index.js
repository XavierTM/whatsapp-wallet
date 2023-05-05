
const { Sequelize } = require("sequelize");
const Account = require("./Account");
const Payment = require("./Payment");

let storage;

if (process.env.NODE_ENV === 'test')
   storage = ':memory:';
else
   storage = `${__dirname}/db.sqlite`;

const sequelize = new Sequelize('', '', '', { 
   dialect: 'sqlite',
   storage,
   logging: false
});


async function init() {

   // initialize models
   Account.init(sequelize);
   Payment.init(sequelize);
   
   // relationships
   /// Payment
   Payment.belongsTo(Payment, {
      foreignKey: {
         name: 'account',
         allowNull: false,
      },
      onDelete: 'CASCADE',
   });

   // initialize DB
   await sequelize.sync({ force: false });

}


module.exports = {
   init,
   sequelize,
}