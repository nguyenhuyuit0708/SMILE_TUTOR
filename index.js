const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');

// Import các khuôn mẫu (Models) — nếu chưa có, bỏ qua hoặc tạo sau
let User, FileModel, Folder, ForumPost;
try { User = require('./models/users'); } catch(e) { /* model chưa có */ }
try { FileModel = require('./models/file'); } catch(e) { /* model chưa có */ }
try { Folder = require('./models/folder'); } catch(e) { /* model chưa có */ }
try { ForumPost = require('./models/forum'); } catch(e) { /* model chưa có */ }

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = "bu-du-ba-da"; // Chìa khóa bí mật để ký Token (demo)

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/image', express.static('image'));
app.use('/download', express.static('uploads'));

// Simple request logger to help debug incoming requests
app.use((req, res, next) => {
    console.log(new Date().toISOString(), req.method, req.originalUrl);
    next();
});

// --- KẾT NỐI DATABASE (nếu cần) ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/SMILE_COURSE';
const safeLogUri = (u) => {
    try {
        return u.replace(/(mongodb(?:\+srv)?:\/\/)(.*@)/, '$1[REDACTED]@');
    } catch (e) { return u; }
};
console.log('Using MongoDB URI:', safeLogUri(MONGO_URI));
mongoose.connect(MONGO_URI)
    .then(() => console.log('Kết nối MongoDB thành công! ✅'))
    .catch(err => console.log('Lỗi kết nối MongoDB:', err));

// Seed default folders (Toán 9-12)
mongoose.connection.once('open', async () => {
    if (!Folder) return;
    const defaults = [
        { name: 'Toán 9', slug: 'toan9' },
        { name: 'Toán 10', slug: 'toan10' },
        { name: 'Toán 11', slug: 'toan11' },
        { name: 'Toán 12', slug: 'toan12' }
    ];
    for (const d of defaults) {
        const ex = await Folder.findOne({ slug: d.slug });
        if (!ex) await new Folder(d).save();
    }
    console.log('Default folders ensured.');
});

// Multer config (nếu dùng upload)
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { 
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + originalName); 
    }
});
const upload = multer({ storage: storage });

// Middleware kiểm tra token JWT và role admin
const protectAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).send('Bạn cần đăng nhập để thực hiện thao tác này!');

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).send('Phiên làm việc hết hạn, vui lòng đăng nhập lại.');
        if (decoded.role !== 'admin') return res.status(403).send('Chỉ Admin mới có quyền upload tài liệu!');
            req.user = decoded;
            next();
        });
    };

    // General authentication middleware (attach user payload to req.user)
    function authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
        if (!authHeader) return res.status(401).send('Token required');
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (err) return res.status(401).send('Invalid token');
            req.user = decoded;
            next();
        });
    }

    // Profile endpoints: GET current user and PUT updates
    app.get('/auth/me', authenticateToken, async (req, res) => {
        try {
            const user = await User.findById(req.user.id).select('-password');
            if (!user) return res.status(404).send('User not found');
            res.json(user);
        } catch (err) {
            console.error('GET /auth/me error', err);
            res.status(500).send('Server error');
        }
    });

    app.put('/auth/profile', authenticateToken, async (req, res) => {
        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).send('User not found');
            const allowed = ['fullName', 'dob', 'phone', 'email', 'school', 'grade'];
            for (const key of allowed) {
                if (req.body[key] !== undefined) user[key] = req.body[key];
            }
            await user.save();
            const out = user.toObject(); delete out.password;
            res.json(out);
        } catch (err) {
            console.error('PUT /auth/profile error', err);
            res.status(500).send('Error updating profile');
        }
    });

    // Upload avatar
    app.post('/auth/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).send('No file uploaded');
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).send('User not found');
            // save accessible url; uploads are served at /download
            user.avatar = '/download/' + req.file.filename;
            await user.save();
            const out = user.toObject(); delete out.password;
            res.json(out);
        } catch (err) {
            console.error('POST /auth/avatar error', err);
            res.status(500).send('Error uploading avatar');
        }
    });

    // Change password: verify old password then set new hashed password
    app.post('/auth/change-password', authenticateToken, async (req, res) => {
        try {
            const { oldPassword, newPassword } = req.body;
            if (!oldPassword || !newPassword) return res.status(400).send('Vui lòng cung cấp mật khẩu cũ và mật khẩu mới');
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).send('User not found');
            const match = await bcrypt.compare(oldPassword, user.password);
            if (!match) return res.status(400).send('Mật khẩu cũ không đúng');
            const hash = await bcrypt.hash(newPassword, 10);
            user.password = hash;
            await user.save();
            res.send('Mật khẩu đã được cập nhật');
        } catch (err) {
            console.error('POST /auth/change-password error', err);
            res.status(500).send('Lỗi server');
        }
    });

// API: kiểm tra token và role admin (dùng bởi client-side của admin.html)
app.get('/api/check-admin', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ ok: false });
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ ok: false });
        return res.json({ ok: decoded.role === 'admin' });
    });
});

// 1. API Đăng ký (demo)
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!User) return res.status(500).send('User model chưa cấu hình.');
        const userExists = await User.findOne({ username });
        if (userExists) return res.status(400).send("Tên đăng nhập đã tồn tại.");

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, role: "hoc_tro" });
        await newUser.save();
        res.status(201).send("Đăng ký thành công!");
    } catch (error) {
        res.status(500).send("Lỗi server khi đăng ký.");
    }
});

// 2. API Đăng nhập trả về JWT
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!User) return res.status(500).json('User model chưa cấu hình.');
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json("Sai tài khoản hoặc mật khẩu.");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json("Sai tài khoản hoặc mật khẩu.");

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '2h' }
        );
        res.json({ token });
    } catch (err) {
        res.status(500).json('Lỗi server');
    }
});

// (upload and file-list routes defined below with folder support)

// API: danh sách folder
app.get('/api/folders', async (req, res) => {
    try {
        if (!Folder) return res.json([]);
        const folders = await Folder.find().sort({ createdAt: 1 });
        res.json(folders);
    } catch (err) {
        res.status(500).json([]);
    }
});

// API: get folder by slug
app.get('/api/folders/slug/:slug', async (req, res) => {
    try {
        if (!Folder) return res.status(500).json({ error: 'Folder model missing' });
        const f = await Folder.findOne({ slug: req.params.slug });
        if (!f) return res.status(404).json({ error: 'Not found' });
        res.json(f);
    } catch (err) { res.status(500).json({ error: 'err' }); }
});

// API: get folder by id
app.get('/api/folders/id/:id', async (req, res) => {
    try {
        if (!Folder) return res.status(500).json({ error: 'Folder model missing' });
        const f = await Folder.findById(req.params.id);
        if (!f) return res.status(404).json({ error: 'Not found' });
        res.json(f);
    } catch (err) { res.status(500).json({ error: 'err' }); }
});

// API: list subfolders of a folder
app.get('/api/folders/:id/subfolders', async (req, res) => {
    try {
        if (!Folder) return res.json([]);
        const subs = await Folder.find({ parent: req.params.id }).sort({ createdAt: 1 });
        res.json(subs);
    } catch (err) { res.status(500).json([]); }
});

// API: create subfolder under a folder (admin only)
app.post('/api/folders/:id/subfolders', protectAdmin, async (req, res) => {
    try {
        if (!Folder) return res.status(500).send('Folder model chưa cấu hình.');
        const parentId = req.params.id;
        const { name, slug } = req.body;
        if (!name) return res.status(400).send('Thiếu name');

        // generate slug server-side if missing
        const slugify = s => s.toString().toLowerCase().trim().replace(/đ/g,'d').normalize('NFD').replace(/[ -\u036f]/g,'').replace(/[^a-z0-9\- ]/g,'').replace(/\s+/g,'-').replace(/\-+/g,'-');
        let base = slug && slug.trim() ? slugify(slug) : slugify(name);
        let candidate = base;
        let i = 1;
        console.log('Create subfolder - computed base:', base, 'parentId:', parentId, 'req.body:', req.body);
        if (!candidate) candidate = 'folder-' + Date.now().toString().slice(-6);
        while (await Folder.findOne({ slug: candidate })) {
            candidate = `${base}-${i++}`;
        }
        console.log('Final slug candidate:', candidate);
        const newF = new Folder({ name, slug: candidate || ('folder-' + Date.now().toString().slice(-6)), parent: parentId });
        await newF.save();
        res.status(201).json(newF);
    } catch (err) { console.error('Error creating subfolder:', err); res.status(500).send('Lỗi server: ' + (err && err.message ? err.message : 'Unknown')); }
});

// API: create folder (admin only)
app.post('/api/folders', protectAdmin, async (req, res) => {
    try {
        if (!Folder) return res.status(500).send('Folder model chưa cấu hình.');
        const { name, slug } = req.body;
        if (!name) return res.status(400).send('Thiếu name');

        // generate slug server-side if missing
        const slugify = s => s.toString().toLowerCase().trim().replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\- ]/g,'').replace(/\s+/g,'-').replace(/\-+/g,'-');
        let base = slug && slug.trim() ? slugify(slug) : slugify(name);
        let candidate = base;
        let i = 1;
        console.log('Create folder - computed base:', base, 'req.body:', req.body);
        if (!candidate) candidate = 'folder-' + Date.now().toString().slice(-6);
        while (await Folder.findOne({ slug: candidate })) {
            candidate = `${base}-${i++}`;
        }
        console.log('Final slug candidate:', candidate);
        const newF = new Folder({ name, slug: candidate || ('folder-' + Date.now().toString().slice(-6)) });
        await newF.save();
        res.status(201).json(newF);
    } catch (err) { console.error('Error creating folder:', err); res.status(500).send('Lỗi server: ' + (err && err.message ? err.message : 'Unknown')); }
});

// API: list files in a folder
app.get('/api/folders/:id/files', async (req, res) => {
    try {
        if (!FileModel) return res.json([]);
        const files = await FileModel.find({ folder: req.params.id }).sort({ uploadDate: -1 });
        res.json(files);
    } catch (err) { res.status(500).json([]); }
});

// Upload into folder: admin only, folderId via query or form field
app.post('/upload', protectAdmin, upload.single('myFile'), async (req, res) => {
    try {
        const folderId = req.body.folderId || req.query.folderId;
        if (!req.file) return res.status(400).send('Chưa chọn file');
        if (!FileModel) return res.status(500).send('File model chưa cấu hình.');
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const newFile = new FileModel({
            originalName: originalName,
            fileName: req.file.filename,
            path: req.file.path,
            folder: folderId || null
        });
        await newFile.save();
        res.send(`Tải lên thành công: ${originalName}`);
    } catch (err) { res.status(500).send('Lỗi upload'); }
});

// API: list all files
app.get('/api/files', async (req, res) => {
    try {
        if (!FileModel) return res.json([]);
        const files = await FileModel.find().sort({ uploadDate: -1 });
        res.json(files);
    } catch (err) { res.status(500).json([]); }
});

// API: rename a folder (admin only)
app.put('/api/folders/:id/name', protectAdmin, async (req, res) => {
    try {
        if (!Folder) return res.status(500).json({ error: 'Folder model missing' });
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Thiếu tên mới' });
        console.log('Updating folder', req.params.id, name); await Folder.findByIdAndUpdate(req.params.id, { name: name });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: rename a file (admin only)
app.put('/api/files/:id/name', protectAdmin, async (req, res) => {
    try {
        if (!FileModel) return res.status(500).json({ error: 'File model missing' });
        const { originalName } = req.body;
        if (!originalName) return res.status(400).json({ error: 'Thiếu tên mới' });
        console.log('Updating file', req.params.id, originalName); await FileModel.findByIdAndUpdate(req.params.id, { originalName: originalName });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: delete a folder (admin only)
app.delete('/api/folders/:id', protectAdmin, async (req, res) => {
    try {
        if (!Folder) return res.status(500).json({ error: 'Folder model missing' });
        
        const deleteFolderRecursive = async (folderId) => {
            const children = await Folder.find({ parent: folderId });
            for (const child of children) {
                await deleteFolderRecursive(child._id);
            }
            if (FileModel) {
                await FileModel.deleteMany({ folder: folderId });
            }
            await Folder.findByIdAndDelete(folderId);
        };
        
        await deleteFolderRecursive(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: delete a file (admin only)
app.delete('/api/files/:id', protectAdmin, async (req, res) => {
    try {
        if (!FileModel) return res.status(500).json({ error: 'File model missing' });
        await FileModel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== FORUM API =====

// GET all forum posts
app.get('/api/forum/posts', async (req, res) => {
    try {
        if (!ForumPost) return res.json([]);
        const posts = await ForumPost.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error('GET /api/forum/posts error:', err);
        res.status(500).json([]);
    }
});

// GET single forum post by ID
app.get('/api/forum/posts/:id', async (req, res) => {
    try {
        if (!ForumPost) return res.status(500).json({ error: 'ForumPost model missing' });
        const post = await ForumPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch (err) {
        console.error('GET /api/forum/posts/:id error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST new forum post (authenticated users)
app.post('/api/forum/posts', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!ForumPost) return res.status(500).send('ForumPost model missing');
        if (!User) return res.status(500).send('User model missing');
        
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).send('Tiêu đề và nội dung là bắt buộc');

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).send('User not found');

        let imageUrl = null;
        if (req.file) {
            imageUrl = '/download/' + req.file.filename;
        }

        const newPost = new ForumPost({
            title: title.trim(),
            content: content.trim(),
            author: user.fullName || user.username,
            authorId: req.user.id,
            authorAvatar: user.avatar,
            image: imageUrl
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        console.error('POST /api/forum/posts error:', err);
        res.status(500).send('Lỗi server: ' + (err.message || 'Unknown'));
    }
});

// POST reply to forum post (authenticated users)
app.post('/api/forum/posts/:id/replies', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!ForumPost) return res.status(500).send('ForumPost model missing');
        if (!User) return res.status(500).send('User model missing');

        const { content } = req.body;
        if (!content) return res.status(400).send('Nội dung trả lời là bắt buộc');

        const post = await ForumPost.findById(req.params.id);
        if (!post) return res.status(404).send('Post not found');

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).send('User not found');

        let imageUrl = null;
        if (req.file) {
            imageUrl = '/download/' + req.file.filename;
        }

        const reply = {
            author: user.fullName || user.username,
            authorId: req.user.id,
            authorAvatar: user.avatar,
            content: content.trim(),
            image: imageUrl
        };

        post.replies.push(reply);
        post.updatedAt = new Date();
        await post.save();

        res.status(201).json(reply);
    } catch (err) {
        console.error('POST /api/forum/posts/:id/replies error:', err);
        res.status(500).send('Lỗi server: ' + (err.message || 'Unknown'));
    }
});

// DELETE forum post (admin or post author only)
app.delete('/api/forum/posts/:id', authenticateToken, async (req, res) => {
    try {
        if (!ForumPost) return res.status(500).send('ForumPost model missing');
        
        const post = await ForumPost.findById(req.params.id);
        if (!post) return res.status(404).send('Post not found');

        // Check if user is admin or post author
        if (req.user.role !== 'admin' && req.user.id !== post.authorId.toString()) {
            return res.status(403).send('Bạn không có quyền xóa bài viết này');
        }

        await ForumPost.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /api/forum/posts/:id error:', err);
        res.status(500).send('Lỗi server: ' + (err.message || 'Unknown'));
    }
});

app.listen(port, () => {
    console.log(`Hệ thống đang chạy tại http://localhost:${port}`);
});

// Extended registration endpoint (collects profile fields)
app.post('/auth/register', async (req, res) => {
    try {
        if (!User) return res.status(500).send('User model chưa cấu hình.');
        const { username, password, fullName, dob, phone, email, school, grade } = req.body;
        // required fields check
        const required = {
            username: 'Tên đăng nhập',
            fullName: 'Họ và tên',
            dob: 'Ngày sinh',
            phone: 'Số điện thoại',
            email: 'Email',
            school: 'Trường',
            grade: 'Khối',
            password: 'Mật khẩu'
        };
        for (const key of Object.keys(required)) {
            if (!req.body[key] || (typeof req.body[key] === 'string' && req.body[key].trim() === '')) {
                return res.status(400).send(`Vui lòng nhập ${required[key]}`);
            }
        }
        const exists = await User.findOne({ username });
        if (exists) return res.status(400).send('Tên đăng nhập đã tồn tại.');

        const hashedPassword = await bcrypt.hash(password, 10);
        // basic dob validation
        let dobDate = new Date(dob);
        if (isNaN(dobDate.getTime())) return res.status(400).send('Ngày sinh không hợp lệ');
        // basic grade validation
        if (!['9','10','11','12'].includes(String(grade))) return res.status(400).send('Khối không hợp lệ');

        const userData = {
            username,
            password: hashedPassword,
            fullName: fullName || '',
            dob: dobDate,
            phone: phone || '',
            email: email || '',
            school: school || '',
            grade: String(grade)
        };
        const newUser = new User(userData);
        await newUser.save();
        res.status(201).send('Đăng ký thành công');
    } catch (err) {
        console.error('Auth register error:', err);
        res.status(500).send('Lỗi server khi đăng ký: ' + (err && err.message ? err.message : 'Unknown'));
    }
});

// --- Admin: user management (admin-only) ---
// List all users (exclude password)
app.get('/api/admin/users', protectAdmin, async (req, res) => {
    try {
        if (!User) return res.status(500).json({ error: 'User model missing' });
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) { console.error('GET /api/admin/users error', err); res.status(500).json([]); }
});

// Get single user by id (exclude password)
app.get('/api/admin/users/:id', protectAdmin, async (req, res) => {
    try {
        if (!User) return res.status(500).json({ error: 'User model missing' });
        const u = await User.findById(req.params.id).select('-password');
        if (!u) return res.status(404).send('User not found');
        res.json(u);
    } catch (err) { console.error('GET /api/admin/users/:id error', err); res.status(500).send('Server error'); }
});

// Update user (fields + optional newPassword)
app.put('/api/admin/users/:id', protectAdmin, async (req, res) => {
    try {
        if (!User) return res.status(500).json({ error: 'User model missing' });
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');

        const allowed = ['fullName', 'dob', 'phone', 'email', 'school', 'grade', 'role'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) user[key] = req.body[key];
        }

        // handle new password
        if (req.body.newPassword) {
            if (typeof req.body.newPassword !== 'string' || req.body.newPassword.length < 6) {
                return res.status(400).send('Mật khẩu mới phải có ít nhất 6 ký tự');
            }
            const hash = await bcrypt.hash(req.body.newPassword, 10);
            user.password = hash;
        }

        // basic validation for grade and role
        if (user.grade && !['9','10','11','12'].includes(String(user.grade))) {
            return res.status(400).send('Khối không hợp lệ');
        }
        if (user.role && !['hoc_tro','admin'].includes(user.role)) {
            return res.status(400).send('Role không hợp lệ');
        }

        await user.save();
        const out = user.toObject(); delete out.password;
        res.json(out);
    } catch (err) { console.error('PUT /api/admin/users/:id error', err); res.status(500).send('Server error'); }
});

// Debug endpoint: echo POST body to verify requests reach the server
// (debug endpoint removed)