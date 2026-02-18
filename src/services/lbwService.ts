import type { 
  AnalysisResult, 
  VideoHistoryItem, 
  DashboardStats, 
  MetricsData,
  AnalysisStep,
  TrajectoryPoint,
  Decision,
  BallMetrics,
  PitchAnalysis,
  ImpactAnalysis,
  WicketPrediction,
  BallType,
  ImpactZone
} from '@/types/lbw';
import { API_ENDPOINTS, USE_MOCK_API } from '@/config/api';
import {
  saveAnalysisToDb,
  getAnalysisFromDb,
  getVideoHistoryFromDb,
  getDashboardStatsFromDb,
  getRecentAnalysesFromDb,
  deleteAnalysisFromDb,
  isUserAuthenticated,
} from './analysisDbService';
import { getSettings, type AnalysisSettings } from './settingsService';

// Import key frame images for mock data
import releaseFrameImg from '@/assets/frames/release-frame.jpg';
import bounceFrameImg from '@/assets/frames/bounce-frame.jpg';
import impactFrameImg from '@/assets/frames/impact-frame.jpg';
import wicketFrameImg from '@/assets/frames/wicket-frame.jpg';

// Simulated delay for realistic demo
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Seeded random number generator for consistent results
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  // Simple seeded random using Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
}

// Progress callback type for file reading
export type FileReadProgressCallback = (progress: number) => void;

// Generate hash from actual file content bytes for consistent seeding
const generateFileHash = async (
  file: File, 
  onProgress?: FileReadProgressCallback
): Promise<number> => {
  try {
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    let hash = 2166136261; // FNV offset basis
    const FNV_PRIME = 16777619;
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const arrayBuffer = await chunk.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      const sampleRate = Math.max(1, Math.floor(bytes.length / 1000));
      for (let i = 0; i < bytes.length; i += sampleRate) {
        hash ^= bytes[i];
        hash = Math.imul(hash, FNV_PRIME);
      }
      
      const progress = ((chunkIndex + 1) / totalChunks) * 100;
      onProgress?.(Math.min(progress, 99));
    }
    
    hash ^= file.size;
    hash = Math.imul(hash, FNV_PRIME);
    
    onProgress?.(100);
    return Math.abs(hash >>> 0);
  } catch (error) {
    console.warn('Failed to read file content, falling back to metadata hash:', error);
    onProgress?.(100);
    const str = `${file.name}-${file.size}-${file.lastModified}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
};

// =============================================================================
// Mock Data Generators (used when USE_MOCK_API is true)
// =============================================================================

// Surface bounce multipliers — affects trajectory bounce height
const SURFACE_BOUNCE: Record<string, number> = {
  concrete: 1.3,
  turf: 1.0,
  matting: 0.9,
  mud: 0.6,
};

// Ball type speed ranges
const BALL_SPEED_RANGES: Record<string, { pace: [number, number]; spin: [number, number] }> = {
  tennis:  { pace: [100, 120], spin: [60, 80] },
  tape:    { pace: [110, 130], spin: [65, 85] },
  leather: { pace: [125, 155], spin: [75, 100] },
};

const generateTrajectory = (rng: SeededRandom, settings: AnalysisSettings): TrajectoryPoint[] => {
  const points: TrajectoryPoint[] = [];
  const bounceX = 120 + rng.next() * 60;
  const impactX = 220 + rng.next() * 40;
  const bounceFactor = SURFACE_BOUNCE[settings.pitch_surface] ?? 1.0;
  // Scale trajectory length based on pitch length ratio (standard=22)
  const lengthScale = settings.pitch_length / 22;
  
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    points.push({
      x: t * bounceX * lengthScale,
      y: 50 + (rng.next() - 0.5) * 10,
      z: 200 - t * 180 + (t * t) * 20,
    });
  }
  
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    points.push({
      x: (bounceX + t * (impactX - bounceX)) * lengthScale,
      y: 50 + (rng.next() - 0.5) * 10,
      z: (20 + t * 40 - (t * t) * 20) * bounceFactor,
    });
  }
  
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    points.push({
      x: (impactX + t * (300 - impactX)) * lengthScale,
      y: 50 + (rng.next() - 0.5) * 15,
      z: (40 + Math.sin(t * Math.PI) * 20) * bounceFactor,
    });
  }
  
  return points;
};

const generateBallMetrics = (rng: SeededRandom, settings: AnalysisSettings): BallMetrics => {
  const ballTypes: BallType[] = ['inswing', 'outswing', 'seam', 'offspin', 'legspin', 'straight'];
  const ballType = ballTypes[Math.floor(rng.next() * ballTypes.length)];
  const isSpin = ballType === 'offspin' || ballType === 'legspin';
  const speedRange = BALL_SPEED_RANGES[settings.ball_type] ?? BALL_SPEED_RANGES.tennis;
  const [minSpeed, maxSpeed] = isSpin ? speedRange.spin : speedRange.pace;
  
  return {
    speed: minSpeed + rng.next() * (maxSpeed - minSpeed),
    releaseSpeed: minSpeed + 10 + rng.next() * (maxSpeed - minSpeed),
    impactSpeed: minSpeed - 5 + rng.next() * (maxSpeed - minSpeed - 5),
    spinRate: isSpin ? 1500 + rng.next() * 1500 : undefined,
    swingDeviation: 2 + rng.next() * 8,
    ballType,
    angleOfEntry: 5 + rng.next() * 15,
  };
};

const generatePitchAnalysis = (pitchedInLine: boolean, rng: SeededRandom, settings: AnalysisSettings): PitchAnalysis => {
  const zone = pitchedInLine ? (rng.next() > 0.5 ? 'inline' : 'outside_off') : 'outside_leg';
  const bounceFactor = SURFACE_BOUNCE[settings.pitch_surface] ?? 1.0;
  
  return {
    zone,
    distanceFromLegStump: zone === 'outside_leg' ? 5 + rng.next() * 30 : -(10 + rng.next() * 40),
    distanceFromOffStump: zone === 'outside_off' ? 5 + rng.next() * 20 : -(15 + rng.next() * 50),
    bounceAngle: (12 + rng.next() * 10) * bounceFactor,
  };
};

const generateImpactAnalysis = (impactInLine: boolean, rng: SeededRandom, settings: AnalysisSettings): ImpactAnalysis => {
  const zone: ImpactZone = impactInLine ? 'inline' : (rng.next() > 0.5 ? 'outside_off' : 'outside_leg');
  const height = 15 + rng.next() * 50;
  const stumpHeight = settings.stump_height * 2.54; // convert inches to cm for display
  const distFromLeg = zone === 'outside_leg' ? 5 + rng.next() * 20 : -(5 + rng.next() * 30);
  
  const isMarginally = Math.abs(distFromLeg) < 5 || (zone === 'inline' && rng.next() > 0.7);
  
  return {
    zone,
    height,
    stumpHeight,
    isAboveStumps: height > stumpHeight,
    distanceFromLegStump: distFromLeg,
    distanceFromOffStump: zone === 'outside_off' ? 5 + rng.next() * 15 : -(20 + rng.next() * 40),
    umpiresCall: isMarginally ? 'UMPIRES_CALL' : 'CLEAR',
  };
};

const generateWicketPrediction = (wouldHit: boolean, rng: SeededRandom): WicketPrediction => {
  const stumps = ['leg', 'middle', 'off', 'missing_leg', 'missing_off', 'over'] as const;
  const stumpHit = wouldHit 
    ? stumps[Math.floor(rng.next() * 3)] as 'leg' | 'middle' | 'off'
    : stumps[3 + Math.floor(rng.next() * 3)] as 'missing_leg' | 'missing_off' | 'over';
  
  const hitPercentage = wouldHit ? 25 + rng.next() * 75 : rng.next() * 25;
  const isUmpiresCall = hitPercentage >= 25 && hitPercentage < 50;
  
  return {
    wouldHit,
    hitPercentage,
    stumpHit,
    umpiresCall: isUmpiresCall ? 'UMPIRES_CALL' : 'CLEAR',
    marginOfError: 1 + rng.next() * 3,
  };
};

const createAnalysisSteps = (): AnalysisStep[] => [
  { id: 'preprocessing', name: 'Frame Preprocessing', description: 'Extracting and normalizing video frames', status: 'pending' },
  { id: 'ball-detection', name: 'Ball Detection', description: 'Identifying cricket ball position in each frame', status: 'pending' },
  { id: 'leg-detection', name: 'Leg Detection', description: 'Detecting batsman leg position and bounding box', status: 'pending' },
  { id: 'impact-detection', name: 'Impact Analysis', description: 'Determining ball-leg contact point', status: 'pending' },
  { id: 'bounce-detection', name: 'Bounce Detection', description: 'Identifying pitch bounce location', status: 'pending' },
  { id: 'trajectory', name: 'Trajectory Calculation', description: 'Computing ball path and extrapolation', status: 'pending' },
  { id: 'wicket-prediction', name: 'Wicket Hit Prediction', description: 'Predicting if ball would hit stumps', status: 'pending' },
];

const generateMockKeyFrames = (rng: SeededRandom): import('@/types/lbw').KeyFrame[] => {
  return [
    {
      type: 'release',
      frameNumber: 5 + Math.floor(rng.next() * 10),
      timestamp: 0.2 + rng.next() * 0.3,
      imageUrl: releaseFrameImg,
      label: 'Ball Release',
      description: 'The moment the bowler releases the ball'
    },
    {
      type: 'bounce',
      frameNumber: 25 + Math.floor(rng.next() * 15),
      timestamp: 0.8 + rng.next() * 0.4,
      imageUrl: bounceFrameImg,
      label: 'Ball Pitching',
      description: 'Ball pitches inline, good length'
    },
    {
      type: 'impact',
      frameNumber: 45 + Math.floor(rng.next() * 20),
      timestamp: 1.5 + rng.next() * 0.5,
      imageUrl: impactFrameImg,
      label: 'Ball Impact',
      description: 'Impact inline, middle height'
    },
    {
      type: 'wicket',
      frameNumber: 60 + Math.floor(rng.next() * 25),
      timestamp: 2.0 + rng.next() * 0.6,
      imageUrl: wicketFrameImg,
      label: 'Wicket Projection',
      description: 'Ball hitting middle stump (85% confidence)'
    }
  ];
};

const generateAnalysisResult = (videoName: string, seed: number, settings: AnalysisSettings): AnalysisResult => {
  const rng = new SeededRandom(seed);
  
  const decision: Decision = rng.next() > 0.45 ? 'OUT' : 'NOT_OUT';
  const confidence = 65 + rng.next() * 30;
  
  const criteria = {
    pitchedInLine: rng.next() > 0.3,
    impactInLine: rng.next() > 0.35,
    legBeforeBat: rng.next() > 0.25,
    wouldHitWickets: decision === 'OUT' ? rng.next() > 0.2 : rng.next() > 0.7,
  };
  
  if (decision === 'OUT') {
    criteria.pitchedInLine = true;
    criteria.impactInLine = true;
    criteria.legBeforeBat = true;
    criteria.wouldHitWickets = true;
  }
  
  const ballMetrics = generateBallMetrics(rng, settings);
  const pitchAnalysis = generatePitchAnalysis(criteria.pitchedInLine, rng, settings);
  const impactAnalysis = generateImpactAnalysis(criteria.impactInLine, rng, settings);
  const wicketPrediction = generateWicketPrediction(criteria.wouldHitWickets, rng);
  
  const isUmpiresCall = impactAnalysis.umpiresCall === 'UMPIRES_CALL' || 
                        wicketPrediction.umpiresCall === 'UMPIRES_CALL';
  
  return {
    id: `analysis-${seed}-${videoName.replace(/\s/g, '_')}`,
    videoId: `video-${seed}`,
    videoName,
    videoThumbnail: '/placeholder.svg',
    decision,
    confidence,
    criteria,
    steps: createAnalysisSteps().map(step => ({ ...step, status: 'completed' as const })),
    trajectory: generateTrajectory(rng, settings),
    impactPoint: { x: 230 + rng.next() * 20, y: 50 },
    bouncePoint: { x: 130 + rng.next() * 40, y: 50 },
    predictedWicketHit: criteria.wouldHitWickets 
      ? { x: 300, y: 48 + rng.next() * 4 } 
      : null,
    createdAt: new Date(),
    ballMetrics,
    pitchAnalysis,
    impactAnalysis,
    wicketPrediction,
    isUmpiresCall,
    keyFrames: generateMockKeyFrames(rng),
  };
};

// Default settings for initial mock data generation
const MOCK_DEFAULTS: AnalysisSettings = {
  pitch_length: 22, pitch_width: 10, crease_distance: 4, pitch_surface: 'concrete',
  ball_type: 'tennis', stump_height: 28, stump_width: 9, confidence_threshold: 50,
  camera_angle: 'side', camera_distance: 'medium',
};

let storedAnalyses: AnalysisResult[] = [
  generateAnalysisResult('match_delivery_01.mp4', 12345, MOCK_DEFAULTS),
  generateAnalysisResult('street_cricket_lbw.mp4', 67890, MOCK_DEFAULTS),
  generateAnalysisResult('practice_session_2.mp4', 11111, MOCK_DEFAULTS),
  generateAnalysisResult('tournament_final_over.mp4', 22222, MOCK_DEFAULTS),
  generateAnalysisResult('backyard_match.mp4', 33333, MOCK_DEFAULTS),
].map((analysis, index) => ({
  ...analysis,
  createdAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
}));

// =============================================================================
// Real API Functions
// =============================================================================

async function uploadToBackend(
  file: File,
  onStepUpdate: (step: AnalysisStep) => void,
  settings: AnalysisSettings
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('settings', JSON.stringify(settings));

  // Set up SSE for step updates if supported, or poll
  const response = await fetch(API_ENDPOINTS.analyze, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${error}`);
  }

  // Check if response is SSE stream for real-time updates
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('text/event-stream')) {
    // Handle Server-Sent Events for real-time step updates
    return new Promise((resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const processEvents = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'step') {
                  onStepUpdate(data.step as AnalysisStep);
                } else if (data.type === 'result') {
                  resolve(parseAnalysisResult(data.result));
                  return;
                } else if (data.type === 'error') {
                  reject(new Error(data.message));
                  return;
                }
              }
            }
          }
        } catch (err) {
          reject(err);
        }
      };

      processEvents();
    });
  } else {
    // Standard JSON response (simpler backend)
    const result = await response.json();
    
    // Emit completed steps
    const steps = createAnalysisSteps();
    for (const step of steps) {
      step.status = 'completed';
      onStepUpdate(step);
    }
    
    return parseAnalysisResult(result);
  }
}

// Parse API response to AnalysisResult
function parseAnalysisResult(data: unknown): AnalysisResult {
  const result = data as Record<string, unknown>;
  
  return {
    id: String(result.id || ''),
    videoId: String(result.video_id || result.videoId || ''),
    videoName: String(result.video_name || result.videoName || ''),
    videoThumbnail: String(result.video_thumbnail || result.videoThumbnail || '/placeholder.svg'),
    decision: (result.decision as Decision) || 'NOT_OUT',
    confidence: Number(result.confidence) || 0,
    criteria: {
      pitchedInLine: Boolean((result.criteria as Record<string, unknown>)?.pitched_in_line ?? (result.criteria as Record<string, unknown>)?.pitchedInLine),
      impactInLine: Boolean((result.criteria as Record<string, unknown>)?.impact_in_line ?? (result.criteria as Record<string, unknown>)?.impactInLine),
      legBeforeBat: Boolean((result.criteria as Record<string, unknown>)?.leg_before_bat ?? (result.criteria as Record<string, unknown>)?.legBeforeBat),
      wouldHitWickets: Boolean((result.criteria as Record<string, unknown>)?.would_hit_wickets ?? (result.criteria as Record<string, unknown>)?.wouldHitWickets),
    },
    steps: (result.steps as AnalysisStep[]) || createAnalysisSteps().map(s => ({ ...s, status: 'completed' as const })),
    trajectory: (result.trajectory as TrajectoryPoint[]) || [],
    impactPoint: (result.impact_point || result.impactPoint) as { x: number; y: number } || { x: 0, y: 0 },
    bouncePoint: (result.bounce_point || result.bouncePoint) as { x: number; y: number } || { x: 0, y: 0 },
    predictedWicketHit: (result.predicted_wicket_hit || result.predictedWicketHit) as { x: number; y: number } | null || null,
    createdAt: new Date(String(result.created_at || result.createdAt || Date.now())),
    ballMetrics: (result.ball_metrics || result.ballMetrics) as BallMetrics | undefined,
    pitchAnalysis: (result.pitch_analysis || result.pitchAnalysis) as PitchAnalysis | undefined,
    impactAnalysis: (result.impact_analysis || result.impactAnalysis) as ImpactAnalysis | undefined,
    wicketPrediction: (result.wicket_prediction || result.wicketPrediction) as WicketPrediction | undefined,
    isUmpiresCall: Boolean(result.is_umpires_call ?? result.isUmpiresCall),
  };
}

// =============================================================================
// Public API Functions (Switch between mock and real)
// =============================================================================

/**
 * Upload and analyze a video
 * Real API: POST /api/analyze (multipart/form-data)
 */
export async function analyzeVideo(
  file: File,
  onStepUpdate: (step: AnalysisStep) => void,
  onFileReadProgress?: FileReadProgressCallback
): Promise<AnalysisResult> {
  // Fetch user settings to influence analysis
  const settings = await getSettings();

  if (!USE_MOCK_API) {
    // Real API call — send settings alongside video
    onFileReadProgress?.(100);
    const result = await uploadToBackend(file, onStepUpdate, settings);
    
    // Save to database
    await saveAnalysisToDb(result);
    
    return result;
  }

  // Mock implementation
  const steps = createAnalysisSteps();
  const seed = await generateFileHash(file, onFileReadProgress);
  
  const existingAnalysis = storedAnalyses.find(a => 
    a.id === `analysis-${seed}-${file.name.replace(/\s/g, '_')}`
  );
  
  if (existingAnalysis) {
    for (let i = 0; i < steps.length; i++) {
      steps[i].status = 'processing';
      onStepUpdate({ ...steps[i] });
      await delay(200);
      steps[i].status = 'completed';
      onStepUpdate({ ...steps[i] });
    }
    return existingAnalysis;
  }
  
  for (let i = 0; i < steps.length; i++) {
    steps[i].status = 'processing';
    onStepUpdate({ ...steps[i] });
    await delay(800 + Math.random() * 600);
    steps[i].status = 'completed';
    steps[i].data = { processed: true, timestamp: Date.now() };
    onStepUpdate({ ...steps[i] });
  }
  
  const result = generateAnalysisResult(file.name, seed, settings);
  result.steps = steps;
  storedAnalyses.unshift(result);
  
  // Save to database if user is authenticated
  try {
    const authenticated = await isUserAuthenticated();
    if (authenticated) {
      await saveAnalysisToDb(result);
    }
  } catch (err) {
    console.warn('Failed to save analysis to database:', err);
  }
  
  return result;
}

/**
 * Get analysis result by ID
 * Real API: GET /api/result/:id
 * Also checks database for stored analyses
 */
export async function getAnalysisResult(id: string): Promise<AnalysisResult | null> {
  // First check if user is authenticated and try database
  try {
    const authenticated = await isUserAuthenticated();
    if (authenticated) {
      const dbResult = await getAnalysisFromDb(id);
      if (dbResult) {
        // Merge with mock data to fill in missing fields
        const mockAnalysis = storedAnalyses.find(a => a.id === id);
        return {
          id: dbResult.id!,
          videoId: mockAnalysis?.videoId || `video-${id}`,
          videoName: dbResult.videoName!,
          videoThumbnail: mockAnalysis?.videoThumbnail || '/placeholder.svg',
          decision: dbResult.decision!,
          confidence: dbResult.confidence!,
          criteria: mockAnalysis?.criteria || {
            pitchedInLine: true,
            impactInLine: true,
            legBeforeBat: true,
            wouldHitWickets: dbResult.decision === 'OUT',
          },
          steps: mockAnalysis?.steps || createAnalysisSteps().map(s => ({ ...s, status: 'completed' as const })),
          trajectory: dbResult.trajectory || [],
          impactPoint: dbResult.impactPoint || { x: 230, y: 50 },
          bouncePoint: mockAnalysis?.bouncePoint || { x: 130, y: 50 },
          predictedWicketHit: dbResult.predictedWicketHit,
          createdAt: dbResult.createdAt!,
          isUmpiresCall: dbResult.isUmpiresCall,
          keyFrames: dbResult.keyFrames,
          ballMetrics: mockAnalysis?.ballMetrics,
          pitchAnalysis: mockAnalysis?.pitchAnalysis,
          impactAnalysis: mockAnalysis?.impactAnalysis,
          wicketPrediction: mockAnalysis?.wicketPrediction,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch from database, falling back to local:', err);
  }

  if (!USE_MOCK_API) {
    try {
      const response = await fetch(API_ENDPOINTS.result(id));
      if (!response.ok) return null;
      const data = await response.json();
      return parseAnalysisResult(data);
    } catch (error) {
      console.error('Failed to fetch analysis result:', error);
      return null;
    }
  }

  await delay(200);
  return storedAnalyses.find(a => a.id === id) || null;
}

/**
 * Get video analysis history
 * Real API: GET /api/history
 * Also fetches from database for authenticated users
 */
export async function getVideoHistory(): Promise<VideoHistoryItem[]> {
  // First check database for authenticated users
  try {
    const authenticated = await isUserAuthenticated();
    if (authenticated) {
      const dbHistory = await getVideoHistoryFromDb();
      if (dbHistory.length > 0) {
        return dbHistory;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch history from database, falling back to local:', err);
  }

  if (!USE_MOCK_API) {
    try {
      const response = await fetch(API_ENDPOINTS.history);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      return (data as Record<string, unknown>[]).map((item) => ({
        id: String(item.id),
        name: String(item.name || item.video_name),
        thumbnail: String(item.thumbnail || item.video_thumbnail || '/placeholder.svg'),
        decision: item.decision as Decision,
        confidence: Number(item.confidence),
        analyzedAt: new Date(String(item.analyzed_at || item.analyzedAt || item.created_at)),
      }));
    } catch (error) {
      console.error('Failed to fetch history:', error);
      return [];
    }
  }

  await delay(300);
  return storedAnalyses.map(analysis => ({
    id: analysis.id,
    name: analysis.videoName,
    thumbnail: analysis.videoThumbnail,
    decision: analysis.decision,
    confidence: analysis.confidence,
    analyzedAt: analysis.createdAt,
  }));
}

/**
 * Get dashboard statistics
 * Real API: GET /api/stats
 * Also fetches from database for authenticated users
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  // First check database for authenticated users
  try {
    const authenticated = await isUserAuthenticated();
    if (authenticated) {
      const dbStats = await getDashboardStatsFromDb();
      if (dbStats.totalAnalyses > 0) {
        return dbStats;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch stats from database, falling back to local:', err);
  }

  if (!USE_MOCK_API) {
    try {
      const response = await fetch(API_ENDPOINTS.stats);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json() as Record<string, unknown>;
      return {
        totalAnalyses: Number(data.total_analyses || data.totalAnalyses || 0),
        outDecisions: Number(data.out_decisions || data.outDecisions || 0),
        notOutDecisions: Number(data.not_out_decisions || data.notOutDecisions || 0),
        averageConfidence: Number(data.average_confidence || data.averageConfidence || 0),
        accuracyRate: Number(data.accuracy_rate || data.accuracyRate || 0),
      };
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      return { totalAnalyses: 0, outDecisions: 0, notOutDecisions: 0, averageConfidence: 0, accuracyRate: 0 };
    }
  }

  await delay(200);
  const total = storedAnalyses.length;
  if (total === 0) {
    return { totalAnalyses: 0, outDecisions: 0, notOutDecisions: 0, averageConfidence: 0, accuracyRate: 0 };
  }
  const outCount = storedAnalyses.filter(a => a.decision === 'OUT').length;
  const avgConfidence = storedAnalyses.reduce((sum, a) => sum + a.confidence, 0) / total;
  
  return {
    totalAnalyses: total,
    outDecisions: outCount,
    notOutDecisions: total - outCount,
    averageConfidence: Math.round(avgConfidence * 10) / 10,
    accuracyRate: 87.5,
  };
}

/**
 * Get detailed metrics data
 * Real API: GET /api/metrics
 */
export async function getMetricsData(): Promise<MetricsData> {
  if (!USE_MOCK_API) {
    try {
      const response = await fetch(API_ENDPOINTS.metrics);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json() as Record<string, unknown>;
      
      return {
        stats: {
          totalAnalyses: Number((data.stats as Record<string, unknown>)?.total_analyses || (data.stats as Record<string, unknown>)?.totalAnalyses || 0),
          outDecisions: Number((data.stats as Record<string, unknown>)?.out_decisions || (data.stats as Record<string, unknown>)?.outDecisions || 0),
          notOutDecisions: Number((data.stats as Record<string, unknown>)?.not_out_decisions || (data.stats as Record<string, unknown>)?.notOutDecisions || 0),
          averageConfidence: Number((data.stats as Record<string, unknown>)?.average_confidence || (data.stats as Record<string, unknown>)?.averageConfidence || 0),
          accuracyRate: Number((data.stats as Record<string, unknown>)?.accuracy_rate || (data.stats as Record<string, unknown>)?.accuracyRate || 0),
        },
        decisionDistribution: (data.decision_distribution || data.decisionDistribution || []) as MetricsData['decisionDistribution'],
        confidenceDistribution: (data.confidence_distribution || data.confidenceDistribution || []) as MetricsData['confidenceDistribution'],
        timelineData: (data.timeline_data || data.timelineData || []) as MetricsData['timelineData'],
        accuracyMetrics: {
          overall: Number((data.accuracy_metrics as Record<string, unknown>)?.overall || (data.accuracyMetrics as Record<string, unknown>)?.overall || 0),
          falsePositive: Number((data.accuracy_metrics as Record<string, unknown>)?.false_positive || (data.accuracy_metrics as Record<string, unknown>)?.falsePositive || 0),
          falseNegative: Number((data.accuracy_metrics as Record<string, unknown>)?.false_negative || (data.accuracy_metrics as Record<string, unknown>)?.falseNegative || 0),
        },
      };
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      const stats = await getDashboardStats();
      return { stats, decisionDistribution: [], confidenceDistribution: [], timelineData: [], accuracyMetrics: { overall: 0, falsePositive: 0, falseNegative: 0 } };
    }
  }

  await delay(400);
  const stats = await getDashboardStats();
  
  return {
    stats,
    decisionDistribution: [
      { name: 'OUT', value: stats.outDecisions, fill: 'hsl(var(--destructive))' },
      { name: 'NOT OUT', value: stats.notOutDecisions, fill: 'hsl(var(--success))' },
    ],
    confidenceDistribution: [
      { range: '60-70%', count: 2 },
      { range: '70-80%', count: 4 },
      { range: '80-90%', count: 6 },
      { range: '90-100%', count: 3 },
    ],
    timelineData: [
      { date: 'Mon', analyses: 3, out: 2, notOut: 1 },
      { date: 'Tue', analyses: 5, out: 2, notOut: 3 },
      { date: 'Wed', analyses: 2, out: 1, notOut: 1 },
      { date: 'Thu', analyses: 4, out: 3, notOut: 1 },
      { date: 'Fri', analyses: 6, out: 2, notOut: 4 },
      { date: 'Sat', analyses: 8, out: 4, notOut: 4 },
      { date: 'Sun', analyses: 5, out: 3, notOut: 2 },
    ],
    accuracyMetrics: {
      overall: 87.5,
      falsePositive: 6.2,
      falseNegative: 6.3,
    },
  };
}

/**
 * Delete an analysis
 * Real API: DELETE /api/result/:id
 * Also deletes from database for authenticated users
 */
export async function deleteAnalysis(id: string): Promise<boolean> {
  // Try to delete from database
  try {
    const authenticated = await isUserAuthenticated();
    if (authenticated) {
      await deleteAnalysisFromDb(id);
    }
  } catch (err) {
    console.warn('Failed to delete from database:', err);
  }

  if (!USE_MOCK_API) {
    try {
      const response = await fetch(API_ENDPOINTS.delete(id), { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      return false;
    }
  }

  await delay(200);
  const index = storedAnalyses.findIndex(a => a.id === id);
  if (index > -1) {
    storedAnalyses.splice(index, 1);
    return true;
  }
  return true; // Return true if deleted from DB even if not in local storage
}

/**
 * Get recent analyses for dashboard
 * Also fetches from database for authenticated users
 */
export async function getRecentAnalyses(limit: number = 3): Promise<AnalysisResult[]> {
  // First check database for authenticated users
  try {
    const authenticated = await isUserAuthenticated();
    if (authenticated) {
      const dbRecent = await getRecentAnalysesFromDb(limit);
      if (dbRecent.length > 0) {
        // Fill in missing fields with defaults
        return dbRecent.map(partial => ({
          id: partial.id!,
          videoId: `video-${partial.id}`,
          videoName: partial.videoName!,
          videoThumbnail: '/placeholder.svg',
          decision: partial.decision!,
          confidence: partial.confidence!,
          criteria: {
            pitchedInLine: true,
            impactInLine: true,
            legBeforeBat: true,
            wouldHitWickets: partial.decision === 'OUT',
          },
          steps: createAnalysisSteps().map(s => ({ ...s, status: 'completed' as const })),
          trajectory: partial.trajectory || [],
          impactPoint: partial.impactPoint || { x: 230, y: 50 },
          bouncePoint: { x: 130, y: 50 },
          predictedWicketHit: partial.predictedWicketHit,
          createdAt: partial.createdAt!,
          isUmpiresCall: partial.isUmpiresCall,
          keyFrames: partial.keyFrames,
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to fetch recent analyses from database, falling back to local:', err);
  }

  if (!USE_MOCK_API) {
    try {
      const response = await fetch(`${API_ENDPOINTS.history}?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch recent analyses');
      const data = await response.json();
      return (data as Record<string, unknown>[]).map(item => parseAnalysisResult(item));
    } catch (error) {
      console.error('Failed to fetch recent analyses:', error);
      return [];
    }
  }

  await delay(200);
  return storedAnalyses.slice(0, limit);
}

/**
 * Check backend health
 * Real API: GET /api/health
 */
export async function checkBackendHealth(): Promise<boolean> {
  if (USE_MOCK_API) return true;
  
  try {
    const response = await fetch(API_ENDPOINTS.health, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}
