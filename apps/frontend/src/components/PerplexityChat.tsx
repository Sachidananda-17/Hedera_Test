import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Container,
  TextField,
  IconButton,
  Typography,
  Paper,
  Chip,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  Button,
  Grow,
  Slide,
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Launch as LaunchIcon,
  Psychology as BrainIcon,
  AutoAwesome as AiIcon,
  ElectricBolt as BoltIcon,
} from '@mui/icons-material';
import { keyframes, styled } from '@mui/system';

// Premium animations
const typing = keyframes`
  0% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0.3; transform: scale(0.8); }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const slideUp = keyframes`
  from { 
    opacity: 0; 
    transform: translateY(30px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 5px rgba(255,255,255,0.1); }
  50% { box-shadow: 0 0 20px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.1); }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

// Styled components
const PremiumCard = styled(Card)(() => ({
  background: 'linear-gradient(145deg, #0f0f0f 0%, #1a1a1a 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(10px)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 10px rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
}));

const GlassCard = styled(Card)(() => ({
  background: 'rgba(15,15,15,0.8)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.06)',
  transition: 'all 0.4s ease',
  '&:hover': {
    background: 'rgba(20,20,20,0.86)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
}));

const ShimmerText = styled(Typography)(() => ({
  background: 'linear-gradient(90deg, #bdbdbd 25%, #ffffff 50%, #bdbdbd 75%)',
  backgroundSize: '1000px 100%',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  animation: `${shimmer} 2s infinite linear`,
}));

interface Source {
  id: string;
  url: string;
  title: string;
  description: string;
  domain: string;
  citationNumber: number;
}

interface AIResponse {
  id: string;
  aiModel: 'GEMINI' | 'OPENAI_GPT4' | 'PERPLEXITY';
  verdict: 'TRUE' | 'FALSE' | 'PARTIALLY_TRUE' | 'MISLEADING' | 'UNVERIFIABLE' | 'NEEDS_CONTEXT';
  confidence: number;
  reasoning: string;
  sources: Source[];
  isWinner: boolean;
  bountyAmount?: number;
  processingTimeMs: number;
  // Optional structured fields parsed from LLM output
  keyClaims?: string[];
  entities?: string[];
  riskLevel?: string;
  riskRationale?: string;
  recommended?: string[];
}

interface FactCheckResult {
  id: string;
  content: string;
  status: 'PROCESSING' | 'COMPLETED';
  responses: AIResponse[];
  bestResponse?: AIResponse;
  totalBounty: number;
  meta?: {
    ipfsCid?: string;
    ipfsUrl?: string | null;
    altUrls?: string[] | null;
    hederaTxUrl?: string | null;
    hederaAccountUrl?: string | null;
    cidAnalyzerUrl?: string | null;
    verification?: {
      ipfsAccessible?: boolean;
      hederaRecorded?: boolean;
    };
  };
}

const PerplexityChat: React.FC<{ accountId?: string }> = ({ accountId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FactCheckResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTyping, setCurrentTyping] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results, currentTyping]);

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'TRUE': return '#e5e5e5';
      case 'FALSE': return '#a3a3a3';
      case 'PARTIALLY_TRUE': return '#c7c7c7';
      case 'MISLEADING': return '#8f8f8f';
      case 'UNVERIFIABLE': return '#7a7a7a';
      case 'NEEDS_CONTEXT': return '#bdbdbd';
      default: return '#9e9e9e';
    }
  };

  const getVerdictGlow = (verdict: string) => {
    const color = getVerdictColor(verdict);
    return `0 0 20px ${color}40, 0 0 40px ${color}20`;
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'TRUE': return <CheckIcon />;
      case 'FALSE': return <CancelIcon />;
      case 'PARTIALLY_TRUE': return <WarningIcon />;
      case 'MISLEADING': return <WarningIcon />;
      case 'UNVERIFIABLE': return <InfoIcon />;
      case 'NEEDS_CONTEXT': return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  const getModelIcon = (model: string) => {
    switch (model) {
      case 'GEMINI': return '🔮';
      case 'OPENAI_GPT4': return '🧠';
      case 'PERPLEXITY': return '🔍';
      default: return '🤖';
    }
  };

  // Heuristic parser to convert markdown-ish analysis into structured data
  const parseStructuredAnalysis = (text: string) => {
    const result: {
      keyClaims: string[];
      entities: string[];
      riskLevel?: string;
      riskRationale?: string;
      recommended: string[];
    } = { keyClaims: [], entities: [], recommended: [] };

    if (!text) return result;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let section: 'key_claims' | 'entities' | 'risk_level' | 'recommended' | null = null;

    const clean = (s: string) => s.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*|__|`/g, '').trim();

    for (const rawLine of lines) {
      const lower = rawLine.toLowerCase();
      if (lower.includes('key_claims')) { section = 'key_claims'; continue; }
      if (lower.includes('entities')) { section = 'entities'; continue; }
      if (lower.includes('recommended_next_actions') || lower.includes('recommended actions')) { section = 'recommended'; continue; }
      if (lower.startsWith('risk_level') || lower.includes('risk_level')) {
        section = 'risk_level';
        const after = rawLine.split(':')[1] || rawLine.split('**:')[1] || '';
        const parts = after.split(/\s*-\s*/);
        const level = (parts[0] || '').replace(/\*\*|__/g, '').trim();
        const rationale = parts.slice(1).join(' - ').trim();
        if (level) result.riskLevel = level.toLowerCase();
        if (rationale) result.riskRationale = rationale;
        continue;
      }

      // bullets within sections
      if (section === 'key_claims' && /^[-*]/.test(rawLine)) {
        const v = clean(rawLine);
        if (v) result.keyClaims.push(v);
        continue;
      }
      if (section === 'entities' && /^[-*]/.test(rawLine)) {
        const v = clean(rawLine);
        if (v) result.entities.push(v);
        continue;
      }
      if (section === 'recommended' && /^[-*]/.test(rawLine)) {
        const v = clean(rawLine);
        if (v) result.recommended.push(v);
        continue;
      }
      if (section === 'risk_level' && /^[-*]/.test(rawLine)) {
        const v = clean(rawLine);
        if (!result.riskRationale && v) result.riskRationale = v;
        continue;
      }
    }

    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const newResult: FactCheckResult = {
      id: Date.now().toString(),
      content: query,
      status: 'PROCESSING',
      responses: [],
      totalBounty: 0,
    };

    setResults(prev => [...prev, newResult]);
    setQuery('');
    setIsLoading(true);
    setCurrentTyping(newResult.id);

    try {
      // Call backend notarize API using Agent Kit flow
      const response = await fetch('http://localhost:3001/api/notarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accountId || '0.0.test',
          contentType: 'text',
          text: query,
          title: 'Fact-check request',
          tags: 'fact-check,frontend'
        }),
      });

      if (!response.ok) throw new Error('Fact-check failed');

      const result = await response.json();

      // Pull Agent Kit analysis text (may include bullets). Fallback to message.
      const agentOutput = result?.internalProcessing?.aiAnalysis?.agentKit?.output;
      const outputText = typeof agentOutput === 'string' 
        ? agentOutput 
        : (agentOutput?.output || agentOutput?.final_output || JSON.stringify(agentOutput));

      // Try to extract URLs as sources from output text
      const urlRegex = /https?:\/\/[^\s)"']+/gi;
      const rawSources = (outputText?.match?.(urlRegex) || []).slice(0, 5);
      const parsedSources: Source[] = rawSources.map((src: string, idx: number) => {
        // Extract first URL if present in the string
        const urlMatch = typeof src === 'string' ? src.match(/https?:\/\/[^\s)"']+/i) : null;
        const url = urlMatch ? urlMatch[0] : '';
        let domain = '';
        try {
          domain = url ? new URL(url).hostname : '';
        } catch (_) {
          domain = '';
        }
        return {
          id: `src-${idx}`,
          url,
          title: url || `Source ${idx + 1}`,
          description: `Reference ${idx + 1}`,
          domain,
          citationNumber: idx + 1,
        };
      });

      const structured = parseStructuredAnalysis(outputText || '');

      const meta: FactCheckResult['meta'] = {
        ipfsCid: result?.ipfsCid,
        ipfsUrl: result?.ipfsGatewayUrl || result?.verificationLinks?.directIPFSAccess || null,
        altUrls: result?.alternativeIPFSUrls || null,
        hederaTxUrl: result?.hederaExplorerUrl || result?.verificationLinks?.hederaTransaction || null,
        hederaAccountUrl: result?.verificationLinks?.hederaAccount || null,
        cidAnalyzerUrl: result?.verificationLinks?.ipfsCidAnalyzer || null,
        verification: {
          ipfsAccessible: result?.internalProcessing?.verificationStatus?.ipfsAccessible ?? undefined,
          hederaRecorded: result?.internalProcessing?.verificationStatus?.hederaRecorded ?? undefined,
        },
      };

      const aiResponse: AIResponse = {
        id: `ai-${Date.now()}`,
        aiModel: 'OPENAI_GPT4',
        verdict: 'NEEDS_CONTEXT',
        confidence: 75,
        reasoning: outputText || 'No analysis returned',
        sources: parsedSources,
        isWinner: true,
        bountyAmount: 3.5,
        processingTimeMs: 1200,
        keyClaims: structured.keyClaims,
        entities: structured.entities,
        riskLevel: structured.riskLevel,
        riskRationale: structured.riskRationale,
        recommended: structured.recommended
      };
      
      setResults(prev => prev.map(r => 
        r.id === newResult.id 
          ? { 
              ...r, 
              status: 'COMPLETED',
              responses: [aiResponse],
              bestResponse: aiResponse,
              totalBounty: 3.5,
              meta
            }
          : r
      ));
    } catch (error) {
      console.error('Fact-check error:', error);
    } finally {
      setIsLoading(false);
      setCurrentTyping(null);
    }
  };

  const SourceCard: React.FC<{ source: Source }> = ({ source }) => (
    <PremiumCard 
      sx={{ 
        mb: 1.5, 
        cursor: 'pointer',
        animation: `${slideUp} 0.6s ease-out`,
        '&:hover': { 
          animation: `${pulse} 0.3s ease-in-out`,
        }
      }}
      onClick={() => window.open(source.url, '_blank')}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box display="flex" alignItems="flex-start" gap={2}>
          <Chip 
            label={source.citationNumber} 
            size="small"
            sx={{ 
              minWidth: 28, 
              height: 28,
              background: 'linear-gradient(45deg, #333, #555)',
              color: '#fff',
              fontWeight: 'bold',
              border: '1px solid rgba(255,255,255,0.2)',
              animation: `${glow} 2s infinite`,
            }}
          />
          <Box flex={1}>
            <Typography 
              variant="subtitle2" 
              fontWeight="bold" 
              mb={0.5}
              sx={{ 
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              {source.title}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ color: '#b0b0b0', mb: 1 }}
            >
              {source.description}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#00ff88',
                  fontWeight: 'bold',
                  textShadow: `0 0 10px #00ff88`,
                }}
              >
                {source.domain}
              </Typography>
              <LaunchIcon sx={{ 
                fontSize: 14, 
                color: '#fff',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'scale(1.2)',
                  filter: 'drop-shadow(0 0 5px #fff)',
                }
              }} />
            </Box>
          </Box>
        </Box>
      </CardContent>
    </PremiumCard>
  );

  const MetricChip: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
    <Chip 
      label={`${label}: ${value}`}
      size="small"
      sx={{
        color: color ? '#000' : '#fff',
        background: color || 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)'
      }}
    />
  );

  const SourceTile: React.FC<{ source: Source }> = ({ source }) => {
    const favicon = source.domain ? `https://www.google.com/s2/favicons?sz=64&domain=${source.domain}` : '';
    return (
      <GlassCard sx={{ p: 2, cursor: 'pointer' }} onClick={() => source.url && window.open(source.url, '_blank') }>
        <Box display="flex" alignItems="center" gap={1.5}>
          {favicon && <img src={favicon} alt={source.domain} width={20} height={20} style={{ borderRadius: 4 }} />}
          <Box>
            <Typography variant="body2" sx={{ color: '#fff' }}>{source.domain || 'Source'}</Typography>
            <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
              {source.title.length > 40 ? source.title.slice(0, 40) + '…' : source.title}
            </Typography>
          </Box>
        </Box>
      </GlassCard>
    );
  };

  const InsightsPanel: React.FC<{ meta?: FactCheckResult['meta']; best?: AIResponse }> = ({ meta, best }) => {
    if (!meta && !best) return null;
    const riskColor = best?.riskLevel === 'high' ? '#ff6b6b' : best?.riskLevel === 'medium' ? '#ffa502' : '#00ff88';
    return (
      <PremiumCard sx={{ mb: 3, p: 2, background: 'linear-gradient(145deg, #101010, #1b1b1b)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" flexWrap="wrap" alignItems="center" gap={1.5} mb={2}>
            {best && (
              <>
                <MetricChip label="Verdict" value={best.verdict.replace('_', ' ')} />
                {typeof best.confidence === 'number' && <MetricChip label="Confidence" value={`${best.confidence}%`} />}
                {best.riskLevel && <MetricChip label="Risk" value={best.riskLevel} color={riskColor} />}
              </>
            )}
            {meta?.verification && (
              <>
                {typeof meta.verification.ipfsAccessible === 'boolean' && (
                  <MetricChip label="IPFS" value={meta.verification.ipfsAccessible ? 'Accessible' : 'Pending'} color={meta.verification.ipfsAccessible ? '#00ff88' : '#ffa502'} />
                )}
                {typeof meta.verification.hederaRecorded === 'boolean' && (
                  <MetricChip label="Hedera" value={meta.verification.hederaRecorded ? 'Recorded' : 'Not recorded'} color={meta.verification.hederaRecorded ? '#00ff88' : '#ff6b6b'} />
                )}
              </>
            )}
          </Box>

          <Box display="flex" flexWrap="wrap" gap={1.5} mb={2}>
            {meta?.ipfsUrl && (
              <Button 
                size="small"
                variant="contained"
                onClick={() => window.open(meta.ipfsUrl!, '_blank')}
                sx={{
                  background: 'linear-gradient(45deg, #00ff88, #00cc6a)',
                  color: '#000'
                }}
              >View on IPFS</Button>
            )}
            {meta?.cidAnalyzerUrl && (
              <Button 
                size="small"
                variant="contained"
                onClick={() => window.open(meta.cidAnalyzerUrl!, '_blank')}
                sx={{ background: 'linear-gradient(45deg, #60a5fa, #a855f7)' }}
              >Analyze CID</Button>
            )}
            {meta?.hederaTxUrl && (
              <Button 
                size="small"
                variant="contained"
                onClick={() => window.open(meta.hederaTxUrl!, '_blank')}
                sx={{ background: 'linear-gradient(45deg, #fbbf24, #f59e0b)', color: '#000' }}
              >Hedera Tx</Button>
            )}
            {meta?.hederaAccountUrl && (
              <Button 
                size="small"
                variant="outlined"
                onClick={() => window.open(meta.hederaAccountUrl!, '_blank')}
                sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
              >Hedera Account</Button>
            )}
          </Box>

          {best?.sources && best.sources.length > 0 && (
            <Box>
              <ShimmerText variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Top Sources</ShimmerText>
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={1.5}>
                {best.sources.slice(0, 3).map(s => (
                  <SourceTile key={s.id} source={s} />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </PremiumCard>
    );
  };

  const AIResponseCard: React.FC<{ response: AIResponse }> = ({ response }) => (
    <PremiumCard 
      sx={{ 
        mb: 3,
        border: response.isWinner 
          ? `2px solid ${getVerdictColor(response.verdict)}` 
          : '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        animation: `${slideUp} 0.8s ease-out`,
        boxShadow: response.isWinner 
          ? getVerdictGlow(response.verdict)
          : 'none',
      }}
    >

      
      <CardContent sx={{ p: 3 }}>
        {/* <Box display="flex" alignItems="center" gap={2} mb={2.5}>
          <Chip 
            icon={getVerdictIcon(response.verdict)}
            label={response.verdict.replace('_', ' ')}
            variant="filled"
            sx={{
              background: `linear-gradient(45deg, ${getVerdictColor(response.verdict)}, ${getVerdictColor(response.verdict)}cc)`,
              color: '#fff',
              fontWeight: 'bold',
              boxShadow: getVerdictGlow(response.verdict),
              '& .MuiChip-icon': {
                color: '#fff',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
              },
            }}
          />
        </Box> */}

        {/* Structured sections if available */}
        {(response.keyClaims && response.keyClaims.length > 0) && (
          <Box mb={2.5}>
            <ShimmerText variant="subtitle1" fontWeight="bold">Key Claims</ShimmerText>
            <Box component="ul" sx={{ pl: 3, mt: 1, color: '#e0e0e0' }}>
              {response.keyClaims.map((c, i) => (
                <li key={`kc-${i}`} style={{ marginBottom: 6 }}>{c}</li>
              ))}
            </Box>
          </Box>
        )}

        {(response.entities && response.entities.length > 0) && (
          <Box mb={2.5}>
            <ShimmerText variant="subtitle1" fontWeight="bold">Entities</ShimmerText>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {response.entities.map((e, i) => (
                <Chip key={`ent-${i}`} label={e} size="small" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} />
              ))}
            </Box>
          </Box>
        )}

        {(response.riskLevel || response.riskRationale) && (
          <Box mb={2.5}>
            <ShimmerText variant="subtitle1" fontWeight="bold">Risk Assessment</ShimmerText>
            <Box display="flex" alignItems="center" gap={1} mt={1}>
              {/* {response.riskLevel && (
                <Chip 
                  label={`Risk: ${response.riskLevel}`}
                  size="small"
                  sx={{ 
                    color: '#000', 
                    background: response.riskLevel === 'high' ? '#ff6b6b' : response.riskLevel === 'medium' ? '#ffa502' : '#00ff88'
                  }}
                />
              )} */}
              {response.riskLevel && (
                <Typography variant="body2" sx={{ color: '#e0e0e0' }}>{response.riskLevel}</Typography>
              )}
            </Box>
          </Box>
        )}

        {(response.recommended && response.recommended.length > 0) && (
          <Box mb={2.5}>
            <ShimmerText variant="subtitle1" fontWeight="bold">Recommended Next Actions</ShimmerText>
            <Box component="ul" sx={{ pl: 3, mt: 1, color: '#e0e0e0' }}>
              {response.recommended.map((r, i) => (
                <li key={`rec-${i}`} style={{ marginBottom: 6 }}>{r}</li>
              ))}
            </Box>
          </Box>
        )}

        {/* Fallback full reasoning */}
        {/* <Typography 
          variant="body1" 
          mb={2.5}
          sx={{ 
            color: '#e0e0e0',
            lineHeight: 1.6,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {response.reasoning}
        </Typography> */}

        {response.sources.length > 0 && (
          <>
            <Typography 
              variant="h6" 
              fontWeight="bold" 
              mb={2}
              sx={{ 
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              Sources ({response.sources.length})
            </Typography>
            {response.sources.map(source => (
              <SourceCard key={source.id} source={source} />
            ))}
          </>
        )}
      </CardContent>
    </PremiumCard>
  );

  const TypingIndicator: React.FC = () => (
    <GlassCard sx={{ p: 3, mb: 2 }}>
      <Box display="flex" alignItems="center" gap={2}>
        <Avatar 
          sx={{ 
            background: 'linear-gradient(45deg, #333, #666)',
            animation: `${pulse} 1.5s infinite`,
          }}
        >
          <AiIcon sx={{ color: '#00ff88' }} />
        </Avatar>
        <Box flex={1}>
          <ShimmerText variant="body1" fontWeight="bold">
            AI models analyzing claim...
          </ShimmerText>
          <Typography variant="body2" sx={{ color: '#888' }}>
            Gemini • OpenAI • Perplexity
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {[0, 1, 2].map(i => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'linear-gradient(45deg, #00ff88, #00cc6a)',
                animation: `${typing} 1.4s infinite ease-in-out`,
                animationDelay: `${i * 0.2}s`,
                boxShadow: '0 0 10px rgba(0,255,136,0.5)',
              }}
            />
          ))}
        </Box>
      </Box>
    </GlassCard>
  );

  return (
    <Box 
      sx={{ 
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
        }
      }}
    >
      {/* Chat Container */}
      <Container maxWidth="md" sx={{ flex: 1, py: 3, overflow: 'hidden', position: 'relative', zIndex: 5 }}>
        <Box 
          sx={{ 
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Messages */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            mb: 3,
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(45deg, #333, #666)',
              borderRadius: '4px',
              '&:hover': {
                background: 'linear-gradient(45deg, #444, #777)',
              },
            },
          }}>
            {results.length === 0 && (
              <Box 
                display="flex" 
                flexDirection="column" 
                alignItems="center" 
                justifyContent="center"
                height="100%"
                textAlign="center"
                sx={{
                  animation: `${slideUp} 1s ease-out`,
                }}
              >
                <Avatar 
                  sx={{ 
                    width: 80, 
                    height: 80,
                    mb: 3,
                    background: 'linear-gradient(45deg, #333, #666)',
                    boxShadow: '0 0 40px rgba(255,255,255,0.1)',
                  }}
                >
                  <SearchIcon sx={{ fontSize: 40, color: '#00ff88' }} />
                </Avatar>
                <ShimmerText variant="h5" mb={2}>
                  Ask any factual question
                </ShimmerText>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#888',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  Get verified answers from multiple premium AI models
                </Typography>
              </Box>
            )}

            {results.map((result, index) => (
              <Slide direction="up" in key={result.id} timeout={500 + index * 100}>
                <Box mb={4}>
                  {/* User Query */}
                  <Box display="flex" justifyContent="flex-end" mb={3}>
                    <GlassCard 
                      sx={{ 
                        maxWidth: '80%',
                        p: 3,
                        background: 'linear-gradient(145deg, #333 0%, #555 100%)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        animation: `${slideUp} 0.6s ease-out`,
                      }}
                    >
                      <Typography 
                        variant="body1"
                        sx={{ 
                          color: '#fff',
                          fontWeight: 500,
                          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        }}
                      >
                        {result.content}
                      </Typography>
                    </GlassCard>
                  </Box>

                  {/* AI Processing/Response */}
                  <Box>
                    {result.status === 'PROCESSING' && (
                      <>
                        <TypingIndicator />
                        <LinearProgress 
                          sx={{ 
                            mt: 2,
                            height: 6,
                            borderRadius: 3,
                            background: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                              background: 'linear-gradient(45deg, #00ff88, #00cc6a)',
                              boxShadow: '0 0 10px rgba(0,255,136,0.5)',
                              borderRadius: 3,
                            },
                          }} 
                        />
                      </>
                    )}

                    {result.status === 'COMPLETED' && result.responses && (
                      <Grow in timeout={800}>
                        <Box>
                          {/* Best Response Summary */}
                          {result.bestResponse && (
                            <>
                            <InsightsPanel meta={result.meta} best={result.bestResponse} />
                            <PremiumCard 
                              sx={{ 
                                mb: 3,
                                background: 'linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
                                border: `2px solid ${getVerdictColor(result.bestResponse.verdict)}`,
                                boxShadow: getVerdictGlow(result.bestResponse.verdict),
                                animation: `${slideUp} 0.8s ease-out`,
                              }}
                            >
                              {/* <CardContent sx={{ p: 3 }}>
                                <Box display="flex" alignItems="center" gap={3} mb={3}>
                                  <Avatar 
                                    sx={{ 
                                      width: 50,
                                      height: 50,
                                      background: 'linear-gradient(45deg, #ffb700, #ffd700)',
                                      animation: `${pulse} 2s infinite`,
                                      boxShadow: '0 0 30px rgba(255,183,0,0.5)',
                                    }}
                                  >
                                    <Typography variant="h5">🏆</Typography>
                                  </Avatar>
                                  <Box flex={1}>
                                    <ShimmerText variant="h5" fontWeight="bold">
                                      Verdict: {result.bestResponse.verdict.replace('_', ' ')}
                                    </ShimmerText>
                                    <Typography 
                                      variant="body1" 
                                      sx={{ 
                                        color: '#888',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                      }}
                                    >
                                      {result.bestResponse.confidence}% confidence • Total bounty: {result.totalBounty} HBAR
                                    </Typography>
                                  </Box>
                                </Box>
                                <Typography 
                                  variant="body1"
                                  sx={{ 
                                    color: '#e0e0e0',
                                    lineHeight: 1.6,
                                    fontSize: '1.1rem',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                  }}
                                >
                                  {result.bestResponse.reasoning}
                                </Typography>
                              </CardContent> */}
                            </PremiumCard>
                            </>
                          )}

                          {result.responses.map((response, idx) => (
                            <Box key={response.id} sx={{ 
                              animation: `${slideUp} 0.6s ease-out`,
                              animationDelay: `${idx * 0.2}s`,
                              animationFillMode: 'both',
                            }}>
                              <AIResponseCard response={response} />
                            </Box>
                          ))}
                        </Box>
                      </Grow>
                    )}
                  </Box>
                </Box>
              </Slide>
            ))}

            {currentTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </Box>

          {/* Input Form */}
          <GlassCard 
            sx={{ 
              p: 3, 
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <form onSubmit={handleSubmit}>
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  ref={inputRef}
                  fullWidth
                  variant="outlined"
                  placeholder="Ask a factual question to fact-check..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        border: '1px solid rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.08)',
                      },
                      '&.Mui-focused': {
                        border: '1px solid #00ff88',
                        boxShadow: '0 0 20px rgba(0,255,136,0.3)',
                        background: 'rgba(255,255,255,0.1)',
                      },
                      '& fieldset': {
                        border: 'none',
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: '#fff',
                      fontSize: '1.1rem',
                      '&::placeholder': {
                        color: '#888',
                        opacity: 1,
                      },
                    },
                  }}
                />
                <IconButton 
                  type="submit" 
                  disabled={!query.trim() || isLoading}
                  sx={{ 
                    width: 56,
                    height: 56,
                    background: 'linear-gradient(45deg, #00ff88, #00cc6a)',
                    color: '#000',
                    transition: 'all 0.3s ease',
                    '&:hover': { 
                      background: 'linear-gradient(45deg, #00cc6a, #00aa55)',
                      transform: 'scale(1.05)',
                      boxShadow: '0 0 20px rgba(0,255,136,0.5)',
                    },
                    '&:disabled': { 
                      background: 'rgba(255,255,255,0.1)',
                      color: '#666',
                    },
                    '&:active': {
                      transform: 'scale(0.95)',
                    },
                  }}
                >
                  <SendIcon sx={{ fontSize: 24 }} />
                </IconButton>
              </Box>
            </form>
          </GlassCard>
        </Box>
      </Container>
    </Box>
  );
};

export default PerplexityChat;
