// app.js
require('dotenv').config();
const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 上传 & Cloudinary 相关
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// ============== 配置区 ==============

// MongoDB：优先用环境变量，其次本地
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo_db';

// Cloudinary（记得在 Vercel / 本地 .env 里配好）
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// 管理密钥：发文章、上传用的简单“密码”
const ADMIN_KEY = process.env.ADMIN_KEY || 'dagu-admin-key';

// Multer：用内存存储
const upload = multer({ storage: multer.memoryStorage() });

// ============== 初始化 ==============

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// 连接 MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch((err) => console.error('❌ MongoDB 连接失败:', err));

// ============== 数据模型 ==============

const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Todo = mongoose.model('Todo', todoSchema);

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    tags: { type: [String], default: [] },

    // 封面图
    coverImage: { type: String, default: '' },

    // 多媒体（图片 / 视频 / 音频）
    media: [
      {
        type: {
          type: String,
          enum: ['image', 'video', 'audio'],
          required: true,
        },
        url: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

const Post = mongoose.model('Post', postSchema);

// ============== 静态页面 ==============

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 写文章页面
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============== 上传接口（给 admin.html 用）=============

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ message: '未授权：管理密钥错误' });
    }

    if (!req.file) {
      return res.status(400).json({ message: '没有收到文件' });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'shidagu-blog',
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary 上传失败:', error);
          return res.status(500).json({ message: '上传失败' });
        }
        return res.json({
          url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ============== Todo 示例接口（你之前的）=============

app.post('/todos', async (req, res) => {
  try {
    const { title, done } = req.body;
    if (!title) return res.status(400).json({ message: 'title 是必填的' });

    const todo = await Todo.create({ title, done });
    res.status(201).json(todo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

app.get('/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ============== 博客文章接口 ==============

// 获取所有文章：GET /posts
app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts); // 前端期望的是“数组”
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建文章：POST /posts
app.post('/posts', async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ message: '未授权：管理密钥错误' });
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

// 获取单篇文章
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

// 更新文章
app.put('/posts/:id', async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ message: '未授权：管理密钥错误' });
    }

    const { id } = req.params;
    const { title, content, tags, coverImage, media } = req.body;

    const updated = await Post.findByIdAndUpdate(
      id,
      { title, content, tags, coverImage, media },
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

// 删除文章
app.delete('/posts/:id', async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ message: '未授权：管理密钥错误' });
    }

    const deleted = await Post.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '文章不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ============== 启动本地服务器 ==============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
