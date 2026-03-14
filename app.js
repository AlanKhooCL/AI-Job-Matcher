document.getElementById('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');

  // 1. Gather the inputs
  const resumeFile = document.getElementById('resume').files[0];
  const url1 = document.getElementById('url1').value;
  const url2 = document.getElementById('url2').value;
  const url3 = document.getElementById('url3').value;

  // Filter out empty URLs
  const urls = [url1, url2, url3].filter(url => url.trim() !== "");

  // 2. Package data for the backend
  const formData = new FormData();
  formData.append('resume', resumeFile);
  formData.append('urls', JSON.stringify(urls));

  // Update UI to show loading
  submitBtn.disabled = true;
  loading.classList.remove('hidden');
  resultsDiv.innerHTML = "";

  try {
    // 3. Send to your Node.js backend 
    // IMPORTANT: You will replace this with your actual Render/Railway URL later
    const response = await fetch('https://job-matcher-api-ud1m.onrender.com/api/evaluate-jobs', {
      method: 'POST',
      body: formData,
      // Note: Do NOT set 'Content-Type' manually when sending FormData. The browser handles the boundaries automatically.
    });

    if (!response.ok) throw new Error("Backend processing failed.");

    const data = await response.json();

    // 4. Render the results
    data.results.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      
      if (job.error) {
        card.innerHTML = `<p><strong>Error with ${job.url}:</strong> ${job.error}</p>`;
      } else {
        card.innerHTML = `
          <h3>${job.title} at ${job.company}</h3>
          <p><strong>Fit Score:</strong> ${job.evaluation.fit_score}%</p>
          <p><strong>Verdict:</strong> ${job.evaluation.verdict}</p>
          <p><em>(Successfully saved to Google Sheets)</em></p>
        `;
      }
      resultsDiv.appendChild(card);
    });

  } catch (error) {
    console.error("Error:", error);
    resultsDiv.innerHTML = `<p style="color: red;">Failed to connect to the server. Make sure your backend is running.</p>`;
  } finally {
    // Reset UI
    submitBtn.disabled = false;
    loading.classList.add('hidden');
  }
});
// --- DASHBOARD LOGIC ---
const analyzeBtn = document.getElementById('analyze-btn');
const dashboardContainer = document.getElementById('dashboard-container');
let radarChart = null; // Keeps track of the chart so we can redraw it later

analyzeBtn.addEventListener('click', async () => {
    // Correctly targeting your HTML input ID
    const resumeInput = document.getElementById('resume');
    const resumeFile = resumeInput.files[0];
    
    if (!resumeFile) {
        alert("Please upload a resume first!");
        return;
    }

    // Show loading state
    analyzeBtn.textContent = "Analyzing DNA...";
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append('resume', resumeFile);

    try {
        // ⚠️ IMPORTANT: Replace YOUR_RENDER_URL with your actual Render URL!
        // Example: 'https://job-matcher-api-xxxx.onrender.com/api/analyze-resume'
        const response = await fetch('https://job-matcher-api-ud1m.onrender.com/api/analyze-resume', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Server error analyzing resume");
        
        const data = await response.json();

        // 1. Populate the text fields
        document.getElementById('dash-summary').textContent = data.summary;
        document.getElementById('dash-exp').textContent = data.years_of_experience;
        document.getElementById('dash-hard').textContent = data.top_hard_skills.join(', ');
        document.getElementById('dash-soft').textContent = data.top_soft_skills.join(', ');

        // 2. Show the dashboard container
        dashboardContainer.style.display = 'block';

        // 3. Draw the Radar Chart!
        drawChart(data.skill_scores);

    } catch (error) {
        console.error("Dashboard error:", error);
        alert("Failed to load dashboard. Check the console.");
    } finally {
        // Reset button
        analyzeBtn.textContent = "📊 Analyze Resume";
        analyzeBtn.disabled = false;
    }
});

// Function to draw the Chart.js Radar Chart
function drawChart(skillScores) {
    const ctx = document.getElementById('skillsRadarChart').getContext('2d');
    
    // If a chart already exists, destroy it before drawing a new one
    if (radarChart) {
        radarChart.destroy();
    }

    // Extract keys (labels) and values (data) from the JSON object
    const labels = Object.keys(skillScores);
    const values = Object.values(skillScores);

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Skill Proficiency (out of 10)',
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.3)',
                borderColor: 'rgba(54, 162, 235, 1)',
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 10 
                }
            }
        }
    });
}
