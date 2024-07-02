const express = require('express');
const fs = require('fs');
const path = require('path');
const redis = require('redis');

const app = express();
const port = 3000;

// Tạo một Redis client
const redisClient = redis.createClient({
    host: '192.168.6.84', // Địa chỉ IP của Redis server, thay đổi nếu cần
    port: 6379 // Cổng của Redis server, thay đổi nếu cần
});
redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

// Đảm bảo client Redis đã sẵn sàng trước khi sử dụng
redisClient.connect().catch(console.error);

// Hàm đọc dữ liệu từ thư mục
const readDataFromFolder = (folderPath, callback) => {
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            callback(err, null);
            return;
        }
        
        const data = {};
        let fileReadCount = 0;

        files.forEach((file) => {
            const filePath = path.join(folderPath, file);
            fs.readFile(filePath, 'utf8', (err, content) => {
                if (err) {
                    callback(err, null);
                    return;
                }

                data[file] = JSON.parse(content);
                fileReadCount++;

                if (fileReadCount === files.length) {
                    callback(null, data);
                }
            });
        });
    });
};

// Hàm lấy dữ liệu từ cache hoặc thư mục
const getData = (folderName, callback) => {
    const cacheKey = `data:${folderName}`;

    redisClient.get(cacheKey, (err, cachedData) => {
        if (err) {
            callback(err, null);
            return;
        }

        if (cachedData) {
            callback(null, JSON.parse(cachedData));
        } else {
            const folderPath = path.join(__dirname, 'eth', folderName);
            readDataFromFolder(folderPath, (err, data) => {
                if (err) {
                    callback(err, null);
                    return;
                }

                redisClient.setex(cacheKey, 3600, JSON.stringify(data)); // Cache for 1 hour
                callback(null, data);
            });
        }
    });
};

// Endpoint để lấy dữ liệu từ các thư mục khác nhau
const folders = [
    'balancer', 'curve', 'defi', 'dodo', 'frax', 
    'kyberclassic', 'pancakev3', 'shiba', 'smardex', 
    'sushiv2', 'sushiv3', 'univ2', 'univ3', 'verse'
];

folders.forEach(folder => {
    app.get(`/${folder}`, (req, res) => {
        getData(folder, (err, data) => {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.json(data);
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
