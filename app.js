// app.js  —— 稳定版（暂时不搞文件上传，只负责文章和 Todo）
// 记得：Vercel 上要在环境变量里配置 MONGODB_URI

require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 中间件
app.use(cors());             // 解决跨域
app.use(express.json());     // 解析 JSON 请求体
app.use(express.static('public')); // 提供 public 里的静态文件（index.html、post.html、admin.html 等）

// 1. 连接 MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo_db';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch((err) => console.error('❌ MongoDB 连接失败:', err));

// 2. Todo 模型（暂时你没怎么用了，但我保留）
const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Todo = mongoose.model('Todo', todoSchema);

// 3. 文章 Post 模型（带封面 & 多媒体）
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    tags: { type: [String], default: [] },

    // 封面图 URL
    coverImage: { type: String, default: '' },

    // 多媒体：图片 / 视频 / 音频（全用 URL）
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

// 4. 首页：返回 public/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== Todo 接口（可以不用管） ==========
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

// ========== 文章接口 ==========
/** 获取所有文章 */
app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

/** 创建文章 */
app.post('/posts', async (req, res) => {
  try {
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

/** 获取单篇文章 */
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

/** 更新文章 */
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

/** 删除文章 */
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

// 9. 启动服务器（本地开发用，Vercel 无视这里）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
