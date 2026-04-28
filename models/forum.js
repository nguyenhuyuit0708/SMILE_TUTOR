const mongoose = require('mongoose');

const ForumPostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorAvatar: { type: String, default: '/image/icons_application/user.png' },
    image: { type: String, default: null },
    replies: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        author: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorAvatar: { type: String, default: '/image/icons_application/user.png' },
        content: { type: String, required: true },
        image: { type: String, default: null },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ForumPost', ForumPostSchema);
