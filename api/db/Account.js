

const { Model, DataTypes } = require("sequelize");
const casual = require('casual');

module.exports = class Account extends Model {
   static init(sequelize) {
      super.init({
         name: {
            type: DataTypes.STRING,
            allowNull: false,
         },
         phone: {
            type: DataTypes.STRING,
            allowNull: false,
         },
         account_number: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: () => casual.integer(100000, 999999).toString()
         },
         balance: {
            type: DataTypes.DOUBLE,
            allowNull: false,
         },
      }, { sequelize })
   }
}