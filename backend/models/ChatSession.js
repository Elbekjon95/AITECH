const mongoose = require('mongoose');

const ChatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  history: {
    type: Array, // [{ role: 'user'|'model', parts: [{ text: '...' }] }]
    default: []
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
