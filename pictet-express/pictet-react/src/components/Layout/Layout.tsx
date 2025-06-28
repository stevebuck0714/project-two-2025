import React from 'react';
import { AppBar, Toolbar, Typography, Container, Box } from '@mui/material';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" sx={{ backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <Toolbar>
          <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <img src="/images/ubs-logo.jpg" alt="UBS" style={{ height: '30px', marginRight: '10px' }} />
            <Typography variant="h6" sx={{ fontFamily: '"Times New Roman", Times, serif' }}>
              UBS
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box component="nav" sx={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee', py: 1 }}>
        <Container>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Link to="/" style={{ color: '#666', textDecoration: 'none' }}>Portfolio</Link>
            <Link to="/portfolio-summary" style={{ color: '#666', textDecoration: 'none' }}>Summary</Link>
            <Link to="/liquidity-summary" style={{ color: '#666', textDecoration: 'none' }}>Liquidity</Link>
            <Link to="/investment-opportunities" style={{ color: '#666', textDecoration: 'none' }}>Opportunities</Link>
            <Link to="/transactions" style={{ color: '#666', textDecoration: 'none' }}>Transactions</Link>
          </Box>
        </Container>
      </Box>

      <Container component="main" sx={{ flex: 1, py: 4 }}>
        {children}
      </Container>

      <Box component="footer" sx={{ backgroundColor: '#f5f5f5', py: 4, mt: 'auto' }}>
        <Container>
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} UBS. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout; 