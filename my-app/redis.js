import { createClient } from 'redis';

export function connectRedis() {
    // 1. Создаем клиент
    // По умолчанию ищет Redis на localhost:6379
    const client = createClient({
        url: 'redis://localhost:6379'
    });

    // 2. Обработка ошибок
    client.on('error', (err) => console.error('Ошибка Redis:', err));

    // 3. Установка соединения
    client.connect();
    
    console.log('Успешное подключение к Redis 🚀');
    return client;
}