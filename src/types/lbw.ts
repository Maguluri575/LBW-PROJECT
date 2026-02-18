export type Decision = 'OUT' | 'NOT_OUT';
export type UmpiresCall = 'UMPIRES_CALL' | 'CLEAR';
export type BallType = 'inswing' | 'outswing' | 'seam' | 'offspin' | 'legspin' | 'straight';
export type PitchZone = 'outside_leg' | 'inline' | 'outside_off';
export type ImpactZone = 'inline' | 'outside_off' | 'outside_leg';

export interface Position {
  x: number;
  y: number;
}

export interface BallPosition extends Position {
  frame: number;
  timestamp: number;
}

export interface TrajectoryPoint extends Position {
  z: number; // height
}

export interface LBWCriteria {
  pitchedInLine: boolean;
  impactInLine: boolean;
  legBeforeBat: boolean;
  wouldHitWickets: boolean;
}

// Extended analysis data for real DRS-like features
export interface BallMetrics {
  speed: number; // km/h
  releaseSpeed: number; // km/h at release
  impactSpeed: number; // km/h at impact
  spinRate?: number; // RPM for spinners
  swingDeviation: number; // cm of swing/spin
  ballType: BallType;
  angleOfEntry: number; // degrees
}

export interface PitchAnalysis {
  zone: PitchZone;
  distanceFromLegStump: number; // cm
  distanceFromOffStump: number; // cm
  bounceAngle: number; // degrees
}

export interface ImpactAnalysis {
  zone: ImpactZone;
  height: number; // cm from ground
  stumpHeight: number; // standard 71.1cm
  isAboveStumps: boolean;
  distanceFromLegStump: number; // cm
  distanceFromOffStump: number; // cm
  umpiresCall: UmpiresCall; // for marginal decisions
}

export interface WicketPrediction {
  wouldHit: boolean;
  hitPercentage: number; // % of ball hitting stumps
  stumpHit: 'leg' | 'middle' | 'off' | 'missing_leg' | 'missing_off' | 'over';
  umpiresCall: UmpiresCall;
  marginOfError: number; // cm
}

export interface AnalysisStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: Record<string, unknown>;
  visualUrl?: string;
}

export interface KeyFrame {
  type: 'bounce' | 'impact' | 'wicket' | 'release';
  frameNumber: number;
  timestamp: number;
  imageUrl: string;
  label: string;
  description: string;
}

export interface AnalysisResult {
  id: string;
  videoId: string;
  videoName: string;
  videoThumbnail: string;
  videoUrl?: string; // URL to the original video for playback
  decision: Decision;
  confidence: number;
  criteria: LBWCriteria;
  steps: AnalysisStep[];
  trajectory: TrajectoryPoint[];
  impactPoint: Position;
  bouncePoint: Position;
  predictedWicketHit: Position | null;
  createdAt: Date;
  // Extended DRS data
  ballMetrics?: BallMetrics;
  pitchAnalysis?: PitchAnalysis;
  impactAnalysis?: ImpactAnalysis;
  wicketPrediction?: WicketPrediction;
  isUmpiresCall?: boolean;
  // Key frame thumbnails
  keyFrames?: KeyFrame[];
}

export interface VideoHistoryItem {
  id: string;
  name: string;
  thumbnail: string;
  decision: Decision;
  confidence: number;
  analyzedAt: Date;
}

export interface DashboardStats {
  totalAnalyses: number;
  outDecisions: number;
  notOutDecisions: number;
  averageConfidence: number;
  accuracyRate: number;
}

export interface MetricsData {
  stats: DashboardStats;
  decisionDistribution: { name: string; value: number; fill: string }[];
  confidenceDistribution: { range: string; count: number }[];
  timelineData: { date: string; analyses: number; out: number; notOut: number }[];
  accuracyMetrics: {
    overall: number;
    falsePositive: number;
    falseNegative: number;
  };
}