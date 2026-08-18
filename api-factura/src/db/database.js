const mysql = require('mysql2/promise');
require('dotenv').config();

const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(
    `Faltan variables de entorno requeridas: ${missing.join(', ')}`
  );
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;