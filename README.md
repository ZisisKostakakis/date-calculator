# Date Calculator

A modern web application for calculating and tracking days across custom date ranges with configurable anchor periods. Perfect for tracking travel days, residency requirements, or any time-based calculations that need to be measured against custom yearly periods.

![Tech Stack](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat&logo=docker)

## ✨ Features

- **Flexible Date Range Management**: Add multiple date ranges with an intuitive range picker interface
- **Custom Anchor Periods**: Configure any anchor date (month/day) to define custom yearly periods (e.g., Sept 17 - Sept 16)
- **Smart Overlap Merging**: Automatically merge overlapping date ranges for accurate calculations
- **Visual Heatmap**: Visualize which days fall within each period with an interactive heatmap
- **Threshold Validation**: Set minimum day requirements per period and get pass/fail indicators
- **Quick Presets**: Fast selection of common ranges (today, last 7/30 days, current/last period)
- **Persistent Storage**: Save and load calculation sessions
- **Modern Dark UI**: Beautiful, responsive dark theme built with Tailwind CSS

## 🏗️ Architecture

This is a frontend application built with modern web technologies:

- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwind CSS
- **Containerization**: Docker Compose for easy deployment
- **State Management**: React hooks with localStorage persistence

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- OR Node.js 20+

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/date-calculator.git
cd date-calculator
```

2. Start the application:
```bash
make up-d
# or
docker compose up -d
```

3. Open your browser:
```bash
make open
# or visit http://localhost:3000
```

### Manual Setup

```bash
cd date_calculator
npm install
npm run dev
```

## 📖 Usage

1. **Add Date Ranges**: Click "Add Date Range" or use quick presets to add date ranges
2. **Configure Settings**:
   - Set anchor date (default: September 17)
   - Set minimum days threshold (default: 183)
   - Toggle overlap merging
   - Enable heatmap visualization
3. **Calculate**: Click "Calculate Total" to see results
4. **View Results**: See totals per period, pass/fail status, and visual heatmap

### Example Use Cases

- **Travel Day Tracking**: Track days spent in different countries for tax/residency purposes
- **Academic Year Calculations**: Calculate days within custom academic periods
- **Project Timeline Analysis**: Measure time spent across overlapping project phases
- **Compliance Tracking**: Monitor days against regulatory periods

## 🛠️ Development

### Available Make Commands

```bash
make help      # Show all available commands
make build     # Build Docker images
make up        # Start services in foreground
make up-d      # Start services in background
make down      # Stop services
make logs      # View logs
make restart   # Restart services
make fresh     # Rebuild and restart
```

### Project Structure

```
date-calculator/
├── date_calculator/     # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx # Main application page
│   │       ├── layout.tsx
│   │       └── globals.css
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── Makefile
```

## 🎨 UI Features

- **Dark Theme**: Modern dark UI with carefully chosen color palette
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Interactive Date Picker**: Flatpickr integration for intuitive date selection
- **Visual Feedback**: Color-coded pass/fail indicators and progress bars
- **Heatmap Visualization**: See exactly which days are counted in each period

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 👤 Author

Built as a portfolio project showcasing full-stack development skills.

---

**Note**: This application is designed for portfolio demonstration purposes. For production use, consider adding authentication, rate limiting, and additional security measures.
