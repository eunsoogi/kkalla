// models/index.js
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import process from 'process'
import { Sequelize } from 'sequelize'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const basename = path.basename(__filename)
const env = process.env.NODE_ENV || 'development'
const config = require('../config/database.json')[env]

class Database {
  constructor() {
    this.models = {}
    this.sequelize = null
    this.Sequelize = Sequelize
  }

  async initialize() {
    await this.createDatabase()
    this.connectDatabase()
    await this.loadModels()
    this.associateModels()
    await this.sync()
    return this
  }

  async createDatabase() {
    let sequelize

    if (config.use_env_variable) {
      sequelize = new Sequelize(process.env[config.use_env_variable], { ...config, database: null })
    } else {
      sequelize = new Sequelize({ ...config, database: null })
    }

    await sequelize.getQueryInterface().createDatabase(config.database)
    await sequelize.close()
  }

  connectDatabase() {
    if (config.use_env_variable) {
      this.sequelize = new Sequelize(process.env[config.use_env_variable], config)
    } else {
      this.sequelize = new Sequelize(config.database, config.username, config.password, config)
    }
  }

  async loadModels() {
    const modelFiles = fs.readdirSync(__dirname).filter((file) => {
      return file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js' && file.indexOf('.test.js') === -1
    })

    for (const file of modelFiles) {
      const modelPath = path.join(__dirname, file)
      const model = await import(modelPath)

      if (model.default && typeof model.default === 'function') {
        const initializedModel = model.default(this.sequelize)
        this.models[initializedModel.name] = initializedModel
      }
    }
  }

  associateModels() {
    Object.values(this.models).forEach((model) => {
      if (model.associate) {
        model.associate(this.models)
      }
    })
  }

  async sync() {
    await this.sequelize.sync()
  }
}

const db = new Database()

export default db
