import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import Layout from './components/Layout/Layout';
import Portfolio from './components/Portfolio/Portfolio';
import PortfolioSummary from './components/Portfolio/PortfolioSummary';

// Create theme
const theme = createTheme({
  typography: {
    fontFamily: '"Inter", sans-serif',
  },
  palette: {
    primary: {
      main: '#8B0000',
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

// Placeholder components (we'll create these next)
const LiquiditySummary = () => <div>Liquidity Summary Page</div>;
const InvestmentOpportunities = () => <div>Investment Opportunities Page</div>;
const Transactions = () => <div>Transactions Page</div>;

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<PortfolioSummary />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/portfolio-summary" element={<PortfolioSummary />} />
            <Route path="/liquidity-summary" element={<LiquiditySummary />} />
            <Route path="/investment-opportunities" element={<InvestmentOpportunities />} />
            <Route path="/transactions" element={<Transactions />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
};

export default App;
