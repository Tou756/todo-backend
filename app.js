// app.js
require('dotenv').config();
const path = require('path');

const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
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

// 9. 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
