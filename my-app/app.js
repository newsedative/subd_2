var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// ==========================================
// 1. ПОДКЛЮЧЕНИЕ БАЗ ДАННЫХ
// ==========================================

// --- PostgreSQL ---
const pgp = require('pg-promise')(/* options */);
const db = pgp('postgres://postgres:admin@localhost:5432/lab_2');

// --- Redis ---
const { connectRedis } = require('./redis');
const cache = connectRedis();

// --- MongoDB ---
const { MongoClient } = require('mongodb');
const url = 'mongodb://localhost:27017'; 
const client = new MongoClient(url);
const dbName = 'lab_3'; 

let mongoDb; 

async function startMongo() {
    try {
        await client.connect();
        console.log("✅ MongoDB успешно подключена");
        mongoDb = client.db(dbName);
    } catch (err) {
        console.error("❌ Ошибка подключения к MongoDB:", err);
    }
}
startMongo();

// --- ClickHouse ---
const { createClient } = require('@clickhouse/client');
const clickhouse = createClient({
    url: 'http://localhost:8123', // Стандартный HTTP-порт ClickHouse в Docker
    username: 'dasha',          // Твое имя пользователя
    password: '123456',         // Твой пароль
    database: 'default'         // База по умолчанию
});


// ==========================================
// 2. ИМПОРТ РОУТЕРОВ
// ==========================================
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var clientsRouter = require('./routes/clients');
var ordersRouter = require('./routes/orders');
var paymentsRouter = require('./routes/payments');

var app = express();

session = require("./session.js");

// ==========================================
// 3. БАЗОВЫЕ НАСТРОЙКИ (MIDDLEWARES)
// ==========================================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ❗️ ГЛАВНЫЙ БЛОК ДЛЯ БАЗ ДАННЫХ ❗️
app.use(function(req, res, next) {
    req.db = db;           // Postgres
    req.cache = cache;     // Redis
    
    if (mongoDb) {
        req.mongo = mongoDb; // MongoDB
    }
    
    req.clickhouse = clickhouse; // ClickHouse
    
    next();
});

// ==========================================
// 4. МАРШРУТИЗАЦИЯ (РОУТЫ)
// ==========================================
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/clients', clientsRouter);
app.use('/orders', ordersRouter);
app.use('/payments', paymentsRouter);

var api      = require('./routes/api');
app.use('/api', api);

var api_auth = require('./routes/api/auth');
api.use('/auth', api_auth);

var api_users = require('./routes/api/users');
api.use('/users', api_users);

// ==========================================
// 5. ОБРАБОТКА ОШИБОК
// ==========================================
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;