import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Grid,
  styled,
  CircularProgress
} from '@mui/material';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  '&.MuiTableCell-head': {
    backgroundColor: '#f8f9fa',
    color: '#333',
    fontWeight: 600,
    fontSize: '0.9rem',
    padding: '10px 12px',
    lineHeight: 1.2,
    verticalAlign: 'bottom',
    borderBottom: '1px solid #eee',
    whiteSpace: 'normal',
    '&:nth-of-type(1)': { minWidth: 140 },
    '&:nth-of-type(2)': { minWidth: 120, textAlign: 'left' },
    '&:nth-of-type(3)': { minWidth: 100, textAlign: 'left' },
    '&:nth-of-type(4)': { minWidth: 80, textAlign: 'right' },
    '&:nth-of-type(n+5):nth-of-type(-n+7)': { minWidth: 120, textAlign: 'right' },
    '&:nth-of-type(n+8)': { minWidth: 90, textAlign: 'right' }
  },
  '&.MuiTableCell-body': {
    fontSize: '0.875rem',
    lineHeight: 1.4,
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    whiteSpace: 'nowrap'
  }
}));

const StyledTableRow = styled(TableRow)({
  '&:nth-of-type(even)': {
    backgroundColor: '#f9fafb',
  },
  '&:hover': {
    backgroundColor: '#f3f4f6',
  }
});

const MetricPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center'
}));

interface PortfolioData {
  'Fund Name': string;
  'Industry/Sector': string;
  'Geography': string;
  'Holding Period': string;
  'Current Value': number;
  'Total Commitment': number;
  'Called Capital': number;
  'Remaining': number;
  'Performance': string;
}

const PortfolioSummary: React.FC = () => {
  const [portfolio1, setPortfolio1] = useState<PortfolioData[]>([]);
  const [portfolio2, setPortfolio2] = useState<PortfolioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:4001/api/portfolios');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Received data:', data); // Debug log
        setPortfolio1(data.portfolio1 || []);
        setPortfolio2(data.portfolio2 || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateTotals = () => {
    const totals = {
      totalPortfolioValue: 0,
      totalCommitment: 0,
      totalCalledCapital: 0,
      totalRemaining: 0
    };

    [...portfolio1, ...portfolio2].forEach(row => {
      totals.totalPortfolioValue += row['Current Value'];
      totals.totalCommitment += row['Total Commitment'];
      totals.totalCalledCapital += row['Called Capital'];
      totals.totalRemaining += row['Remaining'];
    });

    return totals;
  };

  const totals = calculateTotals();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value).replace('EUR', '€');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, color: '#333' }}>
        Portfolio Summary
      </Typography>

      {portfolio1.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ mb: 2, color: '#444', fontSize: '1.25rem' }}>
            Portfolio 1
          </Typography>
          <TableContainer component={Paper} sx={{ minWidth: 800, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Fund Name</StyledTableCell>
                  <StyledTableCell>Industry/Sector</StyledTableCell>
                  <StyledTableCell>Geography</StyledTableCell>
                  <StyledTableCell align="right">Holding Period</StyledTableCell>
                  <StyledTableCell align="right">Current Value</StyledTableCell>
                  <StyledTableCell align="right">Total Commitment</StyledTableCell>
                  <StyledTableCell align="right">Called Capital</StyledTableCell>
                  <StyledTableCell align="right">Remaining</StyledTableCell>
                  <StyledTableCell align="right">Performance</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolio1.map((row, index) => (
                  <StyledTableRow key={index}>
                    <StyledTableCell>{row['Fund Name']}</StyledTableCell>
                    <StyledTableCell>{row['Industry/Sector']}</StyledTableCell>
                    <StyledTableCell>{row['Geography']}</StyledTableCell>
                    <StyledTableCell align="right">{row['Holding Period']}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Current Value'])}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Total Commitment'])}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Called Capital'])}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Remaining'])}</StyledTableCell>
                    <StyledTableCell align="right">{row['Performance']}</StyledTableCell>
                  </StyledTableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {portfolio2.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ mb: 2, color: '#444', fontSize: '1.25rem' }}>
            Portfolio 2
          </Typography>
          <TableContainer component={Paper} sx={{ minWidth: 800, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Fund Name</StyledTableCell>
                  <StyledTableCell>Industry/Sector</StyledTableCell>
                  <StyledTableCell>Geography</StyledTableCell>
                  <StyledTableCell align="right">Holding Period</StyledTableCell>
                  <StyledTableCell align="right">Current Value</StyledTableCell>
                  <StyledTableCell align="right">Total Commitment</StyledTableCell>
                  <StyledTableCell align="right">Called Capital</StyledTableCell>
                  <StyledTableCell align="right">Remaining</StyledTableCell>
                  <StyledTableCell align="right">Performance</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolio2.map((row, index) => (
                  <StyledTableRow key={index}>
                    <StyledTableCell>{row['Fund Name']}</StyledTableCell>
                    <StyledTableCell>{row['Industry/Sector']}</StyledTableCell>
                    <StyledTableCell>{row['Geography']}</StyledTableCell>
                    <StyledTableCell align="right">{row['Holding Period']}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Current Value'])}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Total Commitment'])}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Called Capital'])}</StyledTableCell>
                    <StyledTableCell align="right">{formatCurrency(row['Remaining'])}</StyledTableCell>
                    <StyledTableCell align="right">{row['Performance']}</StyledTableCell>
                  </StyledTableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricPaper>
            <Typography variant="subtitle1" gutterBottom>
              Total Portfolio Value
            </Typography>
            <Typography variant="h6">
              {formatCurrency(totals.totalPortfolioValue)}
            </Typography>
          </MetricPaper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricPaper>
            <Typography variant="subtitle1" gutterBottom>
              Total Committed Capital
            </Typography>
            <Typography variant="h6">
              {formatCurrency(totals.totalCommitment)}
            </Typography>
          </MetricPaper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricPaper>
            <Typography variant="subtitle1" gutterBottom>
              Total Called Capital
            </Typography>
            <Typography variant="h6">
              {formatCurrency(totals.totalCalledCapital)}
            </Typography>
          </MetricPaper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricPaper>
            <Typography variant="subtitle1" gutterBottom>
              Remaining Commitments
            </Typography>
            <Typography variant="h6">
              {formatCurrency(totals.totalRemaining)}
            </Typography>
          </MetricPaper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PortfolioSummary; 