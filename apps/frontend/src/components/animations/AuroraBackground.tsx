import React from 'react';
import { styled, keyframes } from '@mui/system';

const drift = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(10%, -5%, 0) scale(1.1); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
`;

const floatSlow = keyframes`
  0% { transform: translateY(0px); opacity: 0.6; }
  50% { transform: translateY(-12px); opacity: 0.9; }
  100% { transform: translateY(0px); opacity: 0.6; }
`;

const Aurora = styled('div')(() => ({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    width: '80vmax',
    height: '80vmax',
    filter: 'blur(60px)',
    opacity: 0.35,
    animation: `${drift} 18s ease-in-out infinite`,
  },
  '&::before': {
    top: '-20vmax',
    left: '-20vmax',
    background: 'radial-gradient(closest-side, rgba(0,255,136,0.35), transparent 70%)',
  },
  '&::after': {
    bottom: '-20vmax',
    right: '-20vmax',
    background: 'radial-gradient(closest-side, rgba(96,165,250,0.35), transparent 70%)',
    animationDelay: '2.5s',
  },
}));

const Noise = styled('div')(() => ({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  backgroundImage:
    'radial-gradient(circle at 25% 15%, rgba(255,255,255,0.05), transparent 30%),\
     radial-gradient(circle at 75% 30%, rgba(0,255,136,0.05), transparent 35%),\
     radial-gradient(circle at 40% 80%, rgba(96,165,250,0.05), transparent 35%)',
  animation: `${floatSlow} 14s ease-in-out infinite`,
}));

const Container = styled('div')(() => ({
  position: 'relative',
  minHeight: '100vh',
  width: '100%',
  background: 'linear-gradient(180deg, #000000 0%, #121212 50%, #000000 100%)',
}));

export const AuroraBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Container>
      <Aurora />
      <Noise />
      {children}
    </Container>
  );
};

export default AuroraBackground;


