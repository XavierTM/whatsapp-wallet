

const { Model, DataTypes } = require("sequelize");

module.exports = class Payment extends Model {
   static init(sequelize) {
      super.init({
         amount: {
            type: DataTypes.DOUBLE,
            allowNull: false,
         },
      }, { sequelize })
   }
}