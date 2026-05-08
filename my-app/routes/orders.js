var express = require('express');
var router = express.Router();

const totalAmountKey = 'total_amount';

async function getTotalAmount(req) {
    let cachedData = await req.cache.get(totalAmountKey);
    if (cachedData == null){
        totalAmount = await req.db.one('SELECT SUM(amount) AS total_amount FROM orders');
        await req.cache.set(totalAmountKey, totalAmount.total_amount, {EX: 60 * 5}); // Кэшируем на 5 минут
        console.log('Данные получены из базы данных');
        return totalAmount.total_amount;
    }
    console.log('Данные получены из кэша');
    return cachedData;
}

async function invalidateTotalAmountCache(req) {
    await req.cache.del(totalAmountKey);
    console.log('Кэш для total_amount удален');
}

router.get('/', async function(req, res, next) {

    let orders = await req.db.any(`
        SELECT
            orders.id AS id,
            orders.label AS label,
            order_statuses.label AS order_status_label,
            clients.label AS client_label,
            orders.amount AS amount
        FROM
            orders
        INNER JOIN
            clients ON clients.id = orders.id_client
        INNER JOIN
            order_statuses ON order_statuses.id = orders.id_status
    `)
    console.log(orders)
     let clients = await req.db.any(`
        SELECT
            *
        FROM
            clients
    `)
    console.log(clients)

    res.render('orders/list', { title: `Заказы на общую сумму ${await getTotalAmount(req)}`, orders: orders, clients: clients})

});

router.post('/create', async function(req, res, next) {

    let order = req.body

    await req.db.none('INSERT INTO orders(label, id_client, amount) VALUES(${label}, ${id_client}, ${amount})', order);
    await invalidateTotalAmountCache(req);

    res.send({msg: ''})

});

router.post('/:id/status', async (req, res) => {
    const orderId = parseInt(req.params.id);
    const newStatusId = req.body.status_id;

    try {
        // 1. Обновляем статус в основной базе (PostgreSQL)
        await req.db.none('UPDATE orders SET id_status = $1 WHERE id = $2', [newStatusId, orderId]);

        // 2. Логируем это событие в ClickHouse 
        await req.clickhouse.insert({
            table: 'orders_log',
            values: [
                {
                    id: require('crypto').randomUUID(), 
                    order_id: orderId,
                    status_id: parseInt(newStatusId),
                    ts_changed: new Date().toISOString().slice(0, 19).replace('T', ' ') 
                }
            ],
            format: 'JSONEachRow'
        });

        res.json({ success: true, message: "Статус обновлен в Postgres и лог записан в ClickHouse" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Временный GET-роут для проверки через адресную строку
router.get('/:id/status/:status_id', async (req, res) => {
    const orderId = parseInt(req.params.id);
    const newStatusId = parseInt(req.params.status_id); // Теперь берем статус прямо из URL

    try {
        // 1. (Здесь был бы твой код обновления статуса в Postgres)
        // await req.db.none('UPDATE orders SET id_status = $1 WHERE id = $2', [newStatusId, orderId]);

        // 2. Записываем лог в ClickHouse
        await req.clickhouse.insert({
            table: 'orders_log',
            values: [
                {
                    id: require('crypto').randomUUID(), 
                    order_id: orderId,
                    status_id: newStatusId,
                    ts_changed: new Date().toISOString().slice(0, 19).replace('T', ' ') 
                }
            ],
            format: 'JSONEachRow'
        });

        res.json({ 
            success: true, 
            message: `Ура! Статус ${newStatusId} для заказа ${orderId} обновлен и лог записан в ClickHouse` 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/test-clickhouse', async (req, res) => {
    // 1. Проверяем, прикрепился ли клиент
    if (!req.clickhouse) {
        return res.status(500).send("Клиент ClickHouse не подключен!");
    }

    try {
        // 2. Делаем тестовую запись
        await req.clickhouse.insert({
            table: 'orders_log',
            values: [
                {
                    id: require('crypto').randomUUID(), 
                    order_id: 1, // Тестовый номер заказа
                    status_id: 1,  // Тестовый статус
                    ts_changed: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            ],
            format: 'JSONEachRow'
        });

        res.json({ success: true, message: "Ура! Лог успешно записан в ClickHouse" });
    } catch (err) {
        // Если таблицы нет или другая ошибка БД, мы увидим это здесь (статус 500)
        res.status(500).json({ error: err.message, hint: "Возможно, ты забыла создать таблицу orders_log в ClickHouse?" });
    }
});

router.get('/:id', async function(req, res) {

    let id = req.params.id
    let isNumber = /^\d+$/.test(id);
    if (!isNumber){
        res.status(404).send('Not found');
    }

    let order = await req.db.oneOrNone(`
        SELECT
            orders.id AS id,
            orders.label AS label,
            order_statuses.label AS order_status_label,
            clients.label AS client_label,
            orders.amount AS amount
        FROM
            orders
        INNER JOIN
            clients ON clients.id = orders.id_client
        INNER JOIN
            order_statuses ON order_statuses.id = orders.id_status
        WHERE
            orders.id = ${id}
    `)

    if (!order){
        res.status(404).send('Not found');
    }
    else {
        res.render('orders/view', {title: 'Заказ ' + order.label, order: order})
    }

});

module.exports = router;
