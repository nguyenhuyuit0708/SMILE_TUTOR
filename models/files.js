const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    path: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', FileSchema);