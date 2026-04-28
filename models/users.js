const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "hoc_tro" },
    fullName: { type: String, default: '' },
    dob: { type: Date },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    avatar: { type: String, default: '/image/icons_application/user.png' },
    school: { type: String, default: '' },
    grade: { type: String, enum: ['9','10','11','12'], default: '9' },
    createdAt: { type: Date, default: Date.now }
});

module.exports=mongoose.model('User',UserSchema);