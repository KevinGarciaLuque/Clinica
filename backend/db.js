const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  // Conexiones simultáneas a la base de datos (configurable con DB_POOL_SIZE)
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 20,
  queueLimit: 0,
});

module.exports = pool;
