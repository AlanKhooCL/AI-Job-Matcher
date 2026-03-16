const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');

const app = express();

// 1. Enable CORS so your GitHub Pages frontend can talk to this backend
app.use(cors());
app.use(express.json());

// 2. Setup Multer for memory storage (no saving to disk)
const upload = multer({ storage: multer.memoryStorage() });

// 3. Initialize Gemini using Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

// 4. Initialize Google Sheets Auth
// Render allows you to upload credentials.json as a "Secret File" directly into the root directory.
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json', 
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
// IMPORTANT: Replace this with your actual Google Sheet ID
const spreadsheetId = '1z3IN-5x_9MaBGXCcvlf86Io81h7Ypg07q61C_LK1Tms'; 

// --- HELPER FUNCTIONS ---

// Lightweight Scraper using Axios and Cheerio
async function scrapeJob(url) {
  console.log(`Scraping: ${url}`);
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $ = cheerio.load(data);
    
    // Grabs all text from the body, stripping out scripts and styles
    $('script, style, nav, footer').remove(); 
    const description = $('body').text().replace(/\s+/g, ' ').trim();
    
    // We pass generic titles if we can't find specific tags, Gemini will figure it out from the text
    const title = $('title').text() || "Target Role";
    const company = "Company from URL"; 

    return { title, company, description: description.substring(0, 15000) }; // Cap length to save tokens
  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error.message);
    throw new Error("Could not scrape URL. It might be blocking bots.");
  }
}

// The Gemini API Caller
async function evaluateFit(resumeText, jobDescription) {
  const prompt = `
    You are an expert technical recruiter. Evaluate the candidate's resume against the job description.
    Return the evaluation STRICTLY as a JSON object with: 
    "fit_score" (0-100), 
    "verdict" (string), 
    "matching_strengths" (array of strings), 
    "missing_requirements" (array of strings), 
    "resume_tailoring_tips" (array of strings).
    
    RESUME: ${resumeText}
    JOB DESCRIPTION: ${jobDescription}
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  // Clean the response to ensure it's valid JSON
  const jsonString = responseText.replace(/```json\n|\n```/g, '');
  return JSON.parse(jsonString);
}

// --- THE MASTER ROUTE ---

app.post('/api/evaluate-jobs', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Resume PDF is required.' });
    
    const jobUrls = JSON.parse(req.body.urls || '[]'); 
    if (jobUrls.length === 0) return res.status(400).json({ error: 'Please provide job URLs.' });

    // Parse the PDF
    console.log("Parsing resume...");
    const pdfData = await pdfParse(req.file.buffer);
    const cleanResumeText = pdfData.text.replace(/\n\s*\n/g, '\n').replace(/[^\x20-\x7E\n]/g, '').trim();

    // Setup Sheets Client
    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });

    const evaluationResults = [];

    // Process each URL
    for (const url of jobUrls) {
      try {
        const jobData = await scrapeJob(url);
        
        console.log(`Evaluating fit for URL: ${url}...`);
        const aiEvaluation = await evaluateFit(cleanResumeText, jobData.description);
        
        const rowData = [
          new Date().toLocaleDateString(), 
          jobData.company,
          jobData.title,
          aiEvaluation.fit_score,
          url,
          aiEvaluation.verdict,
          aiEvaluation.resume_tailoring_tips.join(' | ') 
        ];

        // Push to Google Sheets
        await googleSheets.spreadsheets.values.append({
          auth,
          spreadsheetId,
          range: "Sheet1!A:G", // Make sure this matches your tab name (e.g., "Sheet1" or "Job Tracker")
          valueInputOption: "USER_ENTERED",
          resource: { values: [rowData] },
        });

        evaluationResults.push({
          url,
          title: jobData.title,
          evaluation: aiEvaluation
        });

      } catch (jobError) {
        evaluationResults.push({ url, error: jobError.message });
      }
    }

    console.log("Processing complete.");
    res.json({ message: "Success", results: evaluationResults });

  } catch (error) {
    console.error("Fatal error:", error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

const PORT = process.env.PORT || 10000;
// --- NEW ROUTE: RESUME ANALYSIS DASHBOARD ---
app.post('/api/analyze-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No resume uploaded.' });
        }

        // 1. Read the PDF
        const pdfParse = require('pdf-parse'); // Ensure this is required at the top of your file too if it isn't already
        const pdfData = await pdfParse(req.file.buffer);
        const resumeText = pdfData.text;

        // 2. The Strict JSON Prompt
        const prompt = `
        You are an expert technical recruiter and data extractor. Analyze the following resume and return a purely structured JSON object. 
        Do not use markdown blocks like \`\`\`json. Just return the raw JSON.
        
        Use this exact structure:
        {
            "years_of_experience": 5,
            "top_hard_skills": ["SQL", "Python", "JavaScript", "Machine Learning", "Data Visualization"],
            "top_soft_skills": ["Stakeholder Management", "Agile", "Problem Solving"],
            "skill_scores": {
                "Data Analysis": 8,
                "Web Development": 7,
                "Communication": 9,
                "Project Management": 6,
                "Machine Learning": 5
            },
            "summary": "A brief 2-sentence summary of the candidate's profile."
        }
        
        Resume Text:
        ${resumeText}
        `;

        // 3. Call Gemini (Using the model we configured earlier)
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                // This is the magic bullet that forces Gemini to output valid JSON
                responseMimeType: "application/json", 
            }
        });

        // 4. Parse and send the data back to the frontend
        const analysisData = JSON.parse(result.response.text());
        res.json(analysisData);

    } catch (error) {
        console.error("Dashboard Analysis Error:", error);
        res.status(500).json({ error: "Failed to analyze resume. Check server logs." });
    }
});

// --- NEW ROUTE: RESUME ENHANCER ---
app.post('/api/enhance-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No resume uploaded.' });
        }

        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(req.file.buffer);
        const resumeText = pdfData.text;

        // The Prompt: Notice how we ask for strict HTML output
        const prompt = `
        You are an elite technical recruiter and executive resume writer. 
        Review the following resume and rewrite the "Work Experience" or "Projects" sections to be significantly more impactful.
        
        Rules:
        1. Use strong action verbs (e.g., Spearheaded, Architected, Optimized).
        2. Emphasize quantifiable business impact and data-driven metrics.
        3. Highlight technical skills and tools seamlessly within the bullet points.
        4. Output the result entirely in clean HTML. Use <h3> for titles/companies and <ul>/<li> for bullet points. 
        5. Do not include markdown formatting like \`\`\`html. Just return the raw HTML code.

        Resume Text:
        ${resumeText}
        `;

        const result = await model.generateContent(prompt);
        const enhancedHTML = result.response.text();

        // Send the HTML back to the frontend
        res.json({ html: enhancedHTML });

    } catch (error) {
        console.error("Enhancer Error:", error);
        res.status(500).json({ error: "Failed to enhance resume." });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
