import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Typography,
  Box
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  '&.MuiTableCell-head': {
    backgroundColor: '#f8f9fa',
    color: '#495057',
    fontWeight: 600,
    padding: '1.2rem 1.5rem',
    borderBottom: '2px solid #dee2e6',
    '&:first-of-type': {
      width: '288px',
      textAlign: 'right'
    },
    '&:last-of-type': {
      textAlign: 'right',
      paddingRight: '2rem'
    }
  },
  '&.MuiTableCell-body': {
    padding: '1.2rem 1.5rem',
    color: '#212529',
    '&:first-of-type': {
      textAlign: 'right',
      fontWeight: 500,
      color: '#374151'
    },
    '&:last-of-type': {
      textAlign: 'right',
      paddingRight: '2rem'
    }
  }
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(even)': {
    backgroundColor: '#f9fafb',
  },
  '&:hover': {
    backgroundColor: '#f3f4f6',
  },
  // Style for the amount cells
  '& .amount': {
    textAlign: 'right',
    fontFamily: '"Inter", sans-serif',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    fontWeight: 500
  }
}));

const TableTitle = styled(Typography)({
  fontSize: '1.75rem',
  fontWeight: 500,
  color: '#1a1a1a',
  marginBottom: '1.5rem',
  fontFamily: '"Times New Roman", Times, serif'
});

interface CashFlowItem {
  date: Date;
  type: string;
  amount: number;
}

const Portfolio: React.FC = () => {
  const [cashFlowData, setCashFlowData] = useState<CashFlowItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    // Temporary mock data - we'll replace this with actual API call later
    const mockData: CashFlowItem[] = [
      { date: new Date('2019-08-13'), amount: 600000, type: 'Capital Call' },
      { date: new Date('2019-10-24'), amount: 240000, type: 'Capital Call' },
      { date: new Date('2019-12-03'), amount: 240000, type: 'Capital Call' },
      { date: new Date('2020-04-14'), amount: 600000, type: 'Capital Call' },
      { date: new Date('2020-08-23'), amount: 960000, type: 'Capital Call' },
      { date: new Date('2020-11-22'), amount: 480000, type: 'Capital Call' },
      { date: new Date('2020-12-22'), amount: 960000, type: 'Capital Call' },
      { date: new Date('2021-03-07'), amount: 600000, type: 'Capital Call' },
      { date: new Date('2021-08-24'), amount: 600000, type: 'Capital Call' }
    ];

    setCashFlowData(mockData);
    setTotalAmount(mockData.reduce((sum, item) => sum + item.amount, 0));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('EUR', '€');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Box sx={{ 
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <TableTitle variant="h4">
        Fund Cash Flows
      </TableTitle>
      
      <Paper 
        elevation={2} 
        sx={{ 
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <StyledTableCell>Date</StyledTableCell>
                <StyledTableCell>Transaction Type</StyledTableCell>
                <StyledTableCell>Amount (EUR)</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cashFlowData.map((item, index) => (
                <StyledTableRow key={index}>
                  <StyledTableCell>{formatDate(item.date)}</StyledTableCell>
                  <StyledTableCell>{item.type}</StyledTableCell>
                  <StyledTableCell className="amount">
                    {formatCurrency(item.amount)}
                  </StyledTableCell>
                </StyledTableRow>
              ))}
              <StyledTableRow>
                <StyledTableCell 
                  colSpan={2} 
                  sx={{ 
                    fontWeight: '600 !important',
                    backgroundColor: '#f8f9fa',
                    borderTop: '2px solid #dee2e6',
                    textAlign: 'left !important'
                  }}
                >
                  Total Capital Called
                </StyledTableCell>
                <StyledTableCell 
                  className="amount"
                  sx={{ 
                    fontWeight: '600 !important',
                    backgroundColor: '#f8f9fa',
                    borderTop: '2px solid #dee2e6'
                  }}
                >
                  {formatCurrency(totalAmount)}
                </StyledTableCell>
              </StyledTableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Portfolio; 