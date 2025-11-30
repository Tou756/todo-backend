// app.js
require('dotenv').config();
const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 内存存储
const upload = multer({ storage: multer.memoryStorage() });

// 管理密钥（和 admin.html 里的 ADMIN_KEY 一样）
const ADMIN_KEY = process.env.ADMIN_KEY || 'dagu-admin-123';

// ========== 基础中间件 ==========

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// ========== 连接 MongoDB ==========
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo_db';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch((err) => console.error('❌ MongoDB 连接失败:', err));

// ========== Mongoose 模型 ==========
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

// ========== 上传接口：POST /upload ==========
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '没有收到文件' });
  }

  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: 'shidagu-blog', resource_type: 'auto' },
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
});


// ========== 首页：静态文件 ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== Todo 相关接口 ==========
app.post('/todos', async (req, res) => {
  try {
    const { title, done } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'title 是必填的' });
    }
    const saved = await new Todo({ title, done }).save();
    res.status(201).json(saved);
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

app.get('/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).json({ message: 'Todo 不存在' });
    res.json(todo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

app.put('/todos/:id', async (req, res) => {
  try {
    const { title, done } = req.body;
    const updated = await Todo.findByIdAndUpdate(
      req.params.id,
      { title, done },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Todo 不存在' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

app.delete('/todos/:id', async (req, res) => {
  try {
    const deleted = await Todo.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Todo 不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ========== 文章相关接口 ==========
app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

app.post('/posts', async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ message: '未授权：管理密钥错误' });
    }

    const { title, content, tags, coverImage, media } = req.body;
    if (!title) return res.status(400).json({ message: 'title 是必填的' });

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

app.put('/posts/:id', async (req, res) => {
  try {
    const { title, content, tags, coverImage, media } = req.body;
    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      { title, content, tags, coverImage, media },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: '文章不存在' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

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

// ========== 启动服务器（本地调试用） ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
