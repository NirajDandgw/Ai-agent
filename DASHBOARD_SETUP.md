# Control-M Smart RCA Dashboard - Quick Start Guide

## Overview

This is a professional React application for monitoring Control-M batch jobs with AI-powered Root Cause Analysis.

## Installation & Setup

### Step 1: Navigate to Dashboard Directory

```bash
cd dashboard
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- React 18
- React Router DOM 6
- Axios
- React Scripts

### Step 3: Start the Development Server

```bash
npm start
```

The application will automatically open in your browser at `http://localhost:3000`

## Application Features

### 1. Dashboard Page (/)

**Summary Metrics:**
- Total Jobs: Overall job count
- Failed Today: Number of failures in the current day
- SLA Breach Count: Jobs that exceeded SLA thresholds
- MTTR: Mean Time To Resolve

**Failed Jobs Table:**
- Job Name
- Status (with color-coded badges)
- Failed Time
- Downtime duration
- Severity level
- View RCA action button

### 2. Job Detail Page (/job/:id)

**Sections:**

A) **Job Basic Information**
   - Job name, status, return code
   - Failure and resolution times
   - Downtime and SLA impact

B) **Root Cause Analysis**
   - Error pattern identification
   - Detailed root cause description
   - Category classification (DB/Infra/Application/File)
   - AI confidence score with visual progress bar

C) **Similar Past Incidents**
   - Historical incident matching
   - Previous root causes
   - Resolution summaries

D) **Recommended Resolution Steps**
   - Numbered, actionable steps
   - Clear guidance for issue resolution

E) **Log Insights**
   - Extracted error messages
   - Pattern match type
   - AI analysis summary

## API Integration

### Backend API Expected

The application expects a REST API at: `http://localhost:8080/api`

**Endpoints:**
- `GET /dashboard/summary` - Dashboard metrics
- `GET /jobs/failed` - Failed jobs list
- `GET /jobs/:id` - Job details
- `GET /jobs/:id/similar-incidents` - Similar incidents

### Mock Data Mode

If the backend is not available, the application automatically uses mock data. This allows you to:
- Test the UI without a backend
- Develop frontend features independently
- Demo the application

## Project Structure

```
dashboard/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── pages/          # Page components
│   │   │   ├── Dashboard.js
│   │   │   └── JobDetail.js
│   │   ├── Card.js         # Card container
│   │   ├── Table.js        # Data table
│   │   ├── StatusBadge.js  # Status indicators
│   │   ├── SummaryCard.js  # Metric cards
│   │   ├── Loader.js       # Loading spinner
│   │   ├── ErrorMessage.js # Error handling
│   │   └── Header.js       # App header
│   ├── services/
│   │   └── api.js          # API integration layer
│   ├── styles/             # CSS modules
│   └── App.js              # Main app component
└── package.json
```

## Key Design Features

### Professional Enterprise Look
- Clean, modern interface
- Consistent spacing and typography
- Subtle shadows and transitions
- Color-coded status indicators

### Responsive Design
- Works on desktop, tablet, and mobile
- Adaptive layouts
- Touch-friendly interactions

### User Experience
- Loading states with spinners
- Error handling with retry options
- Smooth page transitions
- Hover effects and visual feedback

### Code Quality
- Functional React components
- React Hooks (useState, useEffect)
- Proper separation of concerns
- Reusable components
- No console logs in production code

## Customization

### Change API URL

Edit `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://your-backend-url/api';
```

### Modify Colors

Edit `src/styles/index.css`:

```css
:root {
  --primary-color: #1a73e8;
  --danger-color: #ea4335;
  --success-color: #34a853;
  --warning-color: #fbbc04;
}
```

### Add New Status Types

Edit `src/styles/StatusBadge.css` to add new badge styles.

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

## Deployment

The built application can be deployed to:
- Apache/Nginx web servers
- Cloud platforms (AWS S3, Azure, GCP)
- Container platforms (Docker, Kubernetes)
- CDN services

## Troubleshooting

### Port Already in Use

If port 3000 is busy, React will prompt to use another port. Accept or change the port in package.json.

### API Connection Issues

Check:
1. Backend server is running
2. CORS is configured on backend
3. API URL is correct in `api.js`
4. Network connectivity

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Initial load: < 2 seconds
- Page transitions: < 300ms
- API calls: Timeout after 10 seconds
- Automatic retry on failure

## Security Considerations

- No sensitive data in frontend code
- API authentication should be handled by backend
- HTTPS recommended for production
- Environment variables for configuration

## Support

For issues or questions:
1. Check the README.md
2. Review component documentation
3. Inspect browser console for errors
4. Verify API responses

## Next Steps

1. **Connect to Real Backend**: Update API URL and test with live data
2. **Add Authentication**: Implement login/logout if required
3. **Enhance Features**: Add filtering, sorting, search capabilities
4. **Monitor Performance**: Use React DevTools for optimization
5. **Add Tests**: Implement unit and integration tests

## Production Checklist

- [ ] Update API URL to production endpoint
- [ ] Remove mock data fallbacks
- [ ] Enable production build optimizations
- [ ] Configure error tracking (e.g., Sentry)
- [ ] Set up monitoring and analytics
- [ ] Test on all target browsers
- [ ] Verify responsive design on devices
- [ ] Review and optimize bundle size
- [ ] Configure CDN for static assets
- [ ] Set up CI/CD pipeline

---

**Application is ready to use!** Start the development server and explore the features.