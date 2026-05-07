var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    let users = await req.db.any(`
        SELECT
            users.id AS id,
            users.login AS login,
            users.fio AS fio,
            roles.label AS role_label
        FROM
            users
        INNER JOIN roles ON roles.id = users.id_role
    `)
    console.log(users)
    res.json({users: users })

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