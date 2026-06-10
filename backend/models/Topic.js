const mongoose = require('mongoose');

const ExampleSchema = new mongoose.Schema({
  step: { type: String, required: true },
  expression: { type: String, required: true },
  explanation: { type: String, required: true }
});

const TopicSchema = new mongoose.Schema({
  topicId: {
    type: Number,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  emoji: {
    type: String,
    default: '📚'
  },
  definition: {
    type: String,
    required: true
  },
  rules: {
    type: [String],
    default: []
  },
  examples: {
    type: [ExampleSchema],
    default: []
  },
  exercise: {
    question: { type: String, required: true },
    correctAnswer: { type: String, required: true },
    hint: { type: String }
  }
});

module.exports = mongoose.model('Topic', TopicSchema);
