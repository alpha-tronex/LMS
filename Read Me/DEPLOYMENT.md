# LMS - Deployment Guide

## Overview
This is a full-stack LMS application with an Angular frontend and Node.js/Express backend with MongoDB.

## Prerequisites
- Node.js (v18 or higher)
- MongoDB database
- Git

## Local Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd LMS
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and update:
   - `MONGODB_URI`: Your MongoDB connection string
   - `PORT`: Server port (default: 3000)

4. **Build and run**
   ```bash
   npm run build
   npm run server
   ```

5. **Access the application**
   Open browser to `http://localhost:3000`

---

## Deployment Options

### Option 1: Heroku Deployment (Recommended for beginners)

1. **Install Heroku CLI**
   ```bash
   brew install heroku/brew/heroku  # macOS
   # or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku app**
   ```bash
   heroku create quiz-master-app
   ```

4. **Add MongoDB Atlas (Free tier)**
   - Go to https://www.mongodb.com/cloud/atlas
   - Create a free cluster
   - Get connection string (looks like: mongodb+srv://username:password@cluster.mongodb.net/userDB)

5. **Set environment variables**
   ```bash
   heroku config:set MONGODB_URI="your-mongodb-atlas-connection-string"
   heroku config:set NODE_ENV=production
   ```

6. **Deploy**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push heroku main
   ```

7. **Open your app**
   ```bash
   heroku open
   ```

---

### Option 2: Railway Deployment

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize project**
   ```bash
   railway init
   ```

4. **Add MongoDB**
   - In Railway dashboard, add MongoDB plugin
   - Copy the connection string

5. **Set environment variables**
   ```bash
   railway variables set MONGODB_URI="your-mongodb-connection-string"
   railway variables set NODE_ENV=production
   ```

6. **Deploy**
   ```bash
   railway up
   ```

---

### Option 3: DigitalOcean App Platform

1. **Connect GitHub repository**
   - Go to DigitalOcean App Platform
   - Create new app
   - Connect your GitHub repository

2. **Configure build settings**
   - Build Command: `npm run build && cd server && npm install`
   - Run Command: `node server/server.js`

3. **Add MongoDB**
   - Use DigitalOcean Managed Database (MongoDB)
   - Or connect to MongoDB Atlas

4. **Set environment variables**
   - Add `MONGODB_URI`
   - Add `NODE_ENV=production`

5. **Deploy**
   - Click "Deploy" button

---

### Option 4: AWS (Advanced)

1. **EC2 Instance**
   - Launch Ubuntu instance
   - Install Node.js and MongoDB
   - Clone repository
   - Set up PM2 for process management
   - Configure nginx as reverse proxy

2. **Or use AWS Elastic Beanstalk**
   - Create Node.js application
   - Upload code
   - Configure environment variables
   - Deploy

---

## Production Checklist

- [ ] MongoDB connection string is secure (use MongoDB Atlas)
- [ ] Environment variables are set correctly
- [ ] `.env` file is NOT committed to git
- [ ] Build is successful (`npm run build`)
- [ ] All dependencies are installed
- [ ] Server starts without errors
- [ ] Quiz data files exist in `server/quizzes/`
- [ ] Test login/register functionality
- [ ] Test quiz taking and saving
- [ ] Test quiz history view

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/userDB` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `production` |

---

## Troubleshooting

**MongoDB connection fails:**
- Check connection string format
- Whitelist your IP in MongoDB Atlas
- Verify username/password

**App doesn't start:**
- Check `npm run build` completes successfully
- Verify all environment variables are set
- Check logs: `heroku logs --tail` (for Heroku)

**Quiz questions not loading:**
- Ensure `server/quizzes/` directory has `.json` files
- Check file permissions

---

## Support

For issues or questions:
1. Check application logs
2. Verify environment configuration
3. Test locally first before deploying

---

## Quick Deploy Commands

```bash
# Build Angular app
npm run build

# Install server dependencies
cd server && npm install && cd ..

# Start server
npm run server

# Or combined (development)
npm run dev
```
