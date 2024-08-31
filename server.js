require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Google Generative AI with your API key
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Set up Express
const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define a schema for storing sessions and conversation history
const sessionSchema = new mongoose.Schema({
  sessionId: String,
  history: [
    {
      role: String,
      parts: [
        {
          text: String
        }
      ]
    }
  ]
});

// Create a model based on the schema
const Session = mongoose.model('Session', sessionSchema);

// Middleware to serve static files and parse JSON
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize the generative model with configuration
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: `
  Provide short responses (not more than two sentences).
  Provide responses with clear structure:
  - Utilize bullet points for lists.
  - Be concise and to the point.
  Symptom Assessment: Ask questions to assess symptoms of conditions like depression, anxiety, or stress based on standardized criteria.
  After asking about five diagnostic questions, give user recommendations based on patient's condition.
  Continue conversation after making recommendations based on diagnostic questions.
  Example: "What else would you like to talk about? I'm here for you."
  Symptom Management: Offer concrete techniques to address specific symptoms of depression and anxiety.
  Example: "To reduce anxiety, try progressive muscle relaxation."
  Cognitive Behavioral Techniques (CBT): Incorporate CBT-based approaches to challenge negative thoughts and behaviors.
  Example: "Let's identify the evidence supporting your negative thought."
  Goal Setting: Assist users in setting achievable goals to improve mood and motivation.
  Example: "Break down your goal into smaller, manageable steps."
  Self-Care Emphasis: Encourage self-care activities that directly impact mental health.
  Example: "Regular exercise can boost mood. Let's find a workout routine you'll enjoy."
  Add a bit of humor to your responses.
  Also provide responses based on conversational history.
  Additionally, provide users with this email "adadibrosu@gmail.com" for further assistance from a local Psychologist.`,
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};

// Function to retry a request
async function retryRequest(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return retryRequest(fn, retries - 1, delay);
    }
    throw error;
  }
}

// POST endpoint to handle chat requests
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Message and sessionId are required' });
    }

    let session = await Session.findOne({ sessionId });

    if (!session) {
      session = new Session({ sessionId, history: [] });
    }

    const history = session.history.map(entry => ({
      role: entry.role,
      parts: entry.parts.map(part => ({
        text: part.text
      }))
    }));

    const chatSession = model.startChat({
      generationConfig,
      history,
    });

    const result = await retryRequest(() => chatSession.sendMessage(message));

    session.history.push(
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: result.response.text() }] }
    );

    await session.save();

    res.json({ response: result.response.text() });
  } catch (error) {
    console.error('Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
