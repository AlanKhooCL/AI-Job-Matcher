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
