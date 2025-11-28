// api/index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// 1. 基础中间件配置
app.use(cors()); // 允许跨域
app.use(express.json()); // 解析 JSON 请求体

// 2. Multer 配置 (关键：必须使用 memoryStorage，因为 Vercel 不允许写入临时文件到磁盘)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 限制文件大小为 5MB
    },
    fileFilter: (req, file, cb) => {
        // 为了兼容性，将文件名转码（解决中文名乱码问题，虽然我们后面会重命名，但这是好习惯）
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件（JPG/PNG/WebP）'), false);
        }
    }
});

// 3. 初始化 Supabase 客户端
// 注意：这两个变量需要在 Vercel 后台的 Environment Variables 中配置
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 4. 辅助函数：上传文件到 Supabase
async function uploadFile(file) {
    // 提取文件后缀
    const fileExt = file.originalname.split('.').pop();
    // 生成安全的文件名：时间戳 + 随机字符串 + 后缀
    const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    // 上传文件 buffer 到 'images' 存储桶
    const { data, error } = await supabase.storage
        .from('images') // 确保你的 Supabase Storage 里有一个叫 'images' 的 bucket
        .upload(safeFileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) {
        console.error('Supabase 上传错误:', error);
        throw error;
    }

    // 返回存储路径 (例如: "1711123456-xh8d2.jpg")
    // 如果你需要完整的 http 链接，可以使用 supabase.storage.from('images').getPublicUrl(safeFileName)
    return data.path;
}

// 5. 主路由处理
// 使用 upload.fields 处理多个文件上传字段
app.post('/api/feedback', upload.fields([{ name: 'cover' }, { name: 'copyright' }]), async (req, res) => {
    try {
        // 从 body 中获取文本数据
        const { device_serial, phone_number, isbn } = req.body;

        // 简单校验
        if (!req.files || !req.files['cover']) {
            return res.status(400).json({ success: false, error: '必须上传封皮图片' });
        }

        // 上传封皮 (必填)
        const coverImageUrl = await uploadFile(req.files['cover'][0]);

        // 上传版权页 (选填)
        let copyrightImageUrl = null;
        if (req.files['copyright'] && req.files['copyright'][0]) {
            copyrightImageUrl = await uploadFile(req.files['copyright'][0]);
        }

        // 插入数据到 Supabase 数据库
        const { data, error } = await supabase
            .from('feedback') // 确保你的 Supabase Database 里有一个叫 'feedback' 的表
            .insert([{
                device_serial,
                phone_number,
                isbn,
                cover_image: coverImageUrl,
                copyright_image: copyrightImageUrl,
                created_at: new Date() // 如果数据库没设置自动生成时间，建议加上
            }])
            .select();

        if (error) throw error;

        res.json({ success: true, data });

    } catch (err) {
        console.error('处理请求失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. 健康检查路由 (可选，用于测试服务是否运行)
app.get('/api', (req, res) => {
    res.send('教辅信息收集工具后端正在运行 (Vercel)');
});

// 7. 关键：导出 app，而不是调用 app.listen
// Vercel 会自动处理端口监听
module.exports = app;
