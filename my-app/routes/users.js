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


module.exports = router;
