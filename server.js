const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // 允许常见图片格式，避免识别错误
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件（JPG/PNG/WebP）'), false);
    }
  }
});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 上传图片并返回URL（处理中文文件名）
async function uploadFile(file) {
    // 提取文件后缀（比如.jpg、.png）
    const fileExt = file.originalname.split('.').pop();
    // 生成唯一文件名：时间戳 + 随机数 + 后缀（避免中文/重复）
    const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    
    // 用处理后的文件名上传
    const { data, error } = await supabase.storage.from('images').upload(safeFileName, file.buffer);
    if (error) throw error;
    // 返回Supabase里的文件路径（不是原始文件名）
    return data.path;
}

app.post('/api/feedback', upload.fields([{ name: 'cover' }, { name: 'copyright' }]), async (req, res) => {
    try {
        const { device_serial, phone_number, isbn } = req.body;
        const coverImageUrl = await uploadFile(req.files['cover'][0]);
        const copyrightImageUrl = req.files['copyright'] ? await uploadFile(req.files['copyright'][0]) : null;

        const { data, error } = await supabase
            .from('feedback')
            .insert([{ device_serial, phone_number, isbn, cover_image: coverImageUrl, copyright_image: copyrightImageUrl }]);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
