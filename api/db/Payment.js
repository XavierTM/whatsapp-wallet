

const { Model, DataTypes } = require("sequelize");
const casual = require('casual');

module.exports = class Payment extends Model {
   static init(sequelize) {
      super.init({
         ref_code: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: () => casual.uuid,
         },
         amount: {
            type: DataTypes.DOUBLE,
            allowNull: false,
         },
      }, { sequelize })
   }
}