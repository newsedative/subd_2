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
