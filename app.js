// app.js
require('dotenv').config();
const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 新增：处理上传文件 & 接入 Cloudinary
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); // 没装的话：npm install streamifier

// Cloudinary 配置（用环境变量）
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer：用内存存储（不写入磁盘）
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));



// 1. 连接 MongoDB
// 优先用环境变量中的 MongoDB 地址，没有的话就用本地 MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo_db';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

// 2. 定义 Todo 的结构（Schema）和模型（Model）
const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  {
    timestamps: true, // 自动加 createdAt / updatedAt
  }
);

const Todo = mongoose.model('Todo', todoSchema);
// 文章 Post 模型
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    tags: { type: [String], default: [] },

    // 封面图
    coverImage: { type: String, default: '' },

    // 多媒体
    media: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio'],
        required: true,
      },
      url: { type: String, required: true },
    }],
  },
  { timestamps: true }
);


const Post = mongoose.model('Post', postSchema);
// ====== 新增：文件上传接口 POST /upload ======
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '没有收到文件' });
    }

    // 使用 Cloudinary 的上传流，把内存里的 buffer 传过去
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'shidagu-blog', // Cloudinary 中的文件夹名字，随便起
        resource_type: 'auto',  // 自动识别图片/视频/音频
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary 上传失败:', error);
          return res.status(500).json({ message: '上传失败' });
        }
        // 把 Cloudinary 给的访问地址返回给前端
        return res.json({
          url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
        });
      }
    );

    // 把 multer 的 buffer 喂给 Cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 3. 测试接口：GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. 创建 Todo：POST /todos
app.post('/todos', async (req, res) => {
  try {
    const { title, done } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'title 是必填的' });
    }

    const todo = new Todo({ title, done });
    const saved = await todo.save();

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 5. 获取所有 Todo：GET /todos
app.get('/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 6. 获取单个 Todo：GET /todos/:id
app.get('/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findById(id);

    if (!todo) {
      return res.status(404).json({ message: 'Todo 不存在' });
    }

    res.json(todo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 7. 更新 Todo：PUT /todos/:id
app.put('/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, done } = req.body;

    const updated = await Todo.findByIdAndUpdate(
      id,
      { title, done },
      { new: true } // 返回更新后的文档
    );

    if (!updated) {
      return res.status(404).json({ message: 'Todo 不存在' });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 8. 删除 Todo：DELETE /todos/:id
app.delete('/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Todo.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Todo 不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});
// 获取所有文章：GET /posts
app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建文章：POST /posts
// 创建文章：POST /posts
app.post('/posts', async (req, res) => {
  try {
    // 简单鉴权：检查请求头里的 X-Admin-Key
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ message: '未授权：缺少或错误的管理密钥' });
    }

    const { title, content, tags, coverImage, media } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'title 是必填的' });
    }

    const doc = await Post.create({
      title,
      content,
      tags,
      coverImage,
      media,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});


// 获取单篇文章：GET /posts/:id
app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: '文章不存在' });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});
// 更新文章：PUT /posts/:id
app.put('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    const updated = await Post.findByIdAndUpdate(
      id,
      { title, content, tags },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: '文章不存在' });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});


// 删除文章：DELETE /posts/:id  （先简单做删除，之后可以加修改）
app.delete('/posts/:id', async (req, res) => {
  try {
    const deleted = await Post.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '文章不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 9. 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
