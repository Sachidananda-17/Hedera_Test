import React from 'react';
import { keyframes, styled } from '@mui/system';

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const Glow = styled('span')<{ size?: number }>(() => ({
  position: 'absolute',
  inset: -6,
  borderRadius: 12,
  background: 'conic-gradient(from 90deg, rgba(0,255,136,0.12), rgba(96,165,250,0.12), rgba(168,85,247,0.12), rgba(0,255,136,0.12))',
  filter: 'blur(12px)',
  zIndex: 0,
}));

const Text = styled('span')(() => ({
  position: 'relative',
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 10,
  background: 'linear-gradient(90deg, #d1d5db, #ffffff, #d1d5db)',
  backgroundSize: '200% 200%',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  animation: `${shimmer} 4s ease-in-out infinite`,
  fontWeight: 800,
  letterSpacing: 0.3,
}));

export const AnimatedGradientText: React.FC<{ children: React.ReactNode }>= ({ children }) => {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <Glow />
      <Text>{children}</Text>
    </span>
  );
};

export default AnimatedGradientText;


