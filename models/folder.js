const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Folder', FolderSchema);
