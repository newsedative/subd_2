var express = require('express');
var router = express.Router();

const session = require('../session.js');

router.get('/', async function(req, res, next) {
    const sess = session.auth(req);
    const user = sess.user;
    const can = session.can(user);
    console.log(can);

    if (!can.view_users) {
        return res.status(403).send('Forbidden');
    }
    res.render('users/list', { title: 'Пользователи' })

});

// Пример получения доп. данных из коллекции пользователей Mongo
router.get('/:id/extra', async function(req, res) {
    const userId = req.params.id;
    
    // Обращаемся к коллекции 'users' в MongoDB [cite: 20]
    const collection = req.mongo.collection('users');
    
    // Ищем документ (в Mongo id часто хранится как число или ObjectId)
    const extraInfo = await collection.findOne({ postgres_id: parseInt(userId) });
    
    res.json(extraInfo || { message: "Дополнительная информация не найдена" });
});


module.exports = router;
