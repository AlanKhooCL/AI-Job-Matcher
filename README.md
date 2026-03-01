# Job Application Tracker

A lightweight, client-side web application for tracking job applications. All data is stored locally in your browser using localStorage -- no server or database required.

## Features

- **Add, edit, and delete** job applications with details like company, position, date, status, location, salary range, job URL, and notes
- **Status tracking** with visual badges: Applied, Phone Screen, Interview, Offer, Rejected, Withdrawn
- **Dashboard stats** showing counts per status at a glance
- **Search** by company name, position, or location
- **Filter** by application status (also via clickable stat cards)
- **Sort** by date, company name, or status
- **Export to CSV** for use in spreadsheets or external tools
- **Responsive design** that works on desktop, tablet, and mobile
- **Keyboard accessible** with Escape to close modals

## Getting Started

No build tools or dependencies are needed. Just open `index.html` in a browser:

```bash
# Option 1: Open the file directly
open index.html

# Option 2: Use a simple HTTP server
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Project Structure

```
.
├── index.html          # Main HTML page
├── css/
│   └── styles.css      # All styles
├── js/
│   └── app.js          # Application logic (vanilla JS, no dependencies)
└── README.md
```

## Data Storage

Application data is stored in your browser's `localStorage` under the key `job_applications`. Data persists across page reloads but is specific to the browser and device you're using.

To back up your data, use the **Export CSV** button to download a spreadsheet-compatible file.

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge).
