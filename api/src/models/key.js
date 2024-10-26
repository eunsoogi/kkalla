import { Model, DataTypes } from 'sequelize';
import { KEY_TYPES } from '../const/key.js';

class Key extends Model {}

export default (sequelize) => {
  Key.init(
    {
      keyType: {
        type: DataTypes.ENUM(...KEY_TYPES),
        allowNull: false,
        unique: true,
      },
      apiKey: {
        type: DataTypes.STRING,
        allowNull: false
      },
      secretKey: {
        type: DataTypes.STRING,
        allowNull: true
      },
    },
    {
      sequelize,
      modelName: 'Key',
    }
  );

  return Key;
};
