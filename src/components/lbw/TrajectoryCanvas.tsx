import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, FastForward, Eye, Video, Target } from 'lucide-react';
import type { TrajectoryPoint, Position } from '@/types/lbw';

interface TrajectoryCanvasProps {
  trajectory: TrajectoryPoint[];
  impactPoint: Position;
  bouncePoint: Position;
  predictedWicketHit: Position | null;
  decision: 'OUT' | 'NOT_OUT';
}

type ViewMode = 'side' | 'top' | 'stump';
type AnalysisPhase = 'tracking' | 'zones' | 'prediction' | 'decision';

export function TrajectoryCanvas({
  trajectory,
  impactPoint,
  bouncePoint,
  predictedWicketHit,
  decision,
}: TrajectoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('side');
  const [phase, setPhase] = useState<AnalysisPhase>('tracking');
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Convert provided trajectory to smooth animation points
  const generateSmoothTrajectory = useCallback(() => {
    if (!trajectory || trajectory.length < 2) {
      // Fallback trajectory if none provided
      const points: { x: number; y: number; z: number }[] = [];
      const startX = 50;
      const startZ = 220;
      const bounceX = impactPoint?.x ? impactPoint.x * 0.6 : 280;
      const impX = impactPoint?.x || 480;
      const impY = decision === 'OUT' ? 5 : -15;
      const stumpX = 580;
      
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = startX + t * (bounceX - startX);
        const y = 0;
        const z = startZ * (1 - t) * (1 - t * 0.3);
        points.push({ x, y, z: Math.max(0, z) });
      }
      
      for (let i = 1; i <= 35; i++) {
        const t = i / 35;
        const x = bounceX + t * (impX - bounceX);
        const y = impY * t;
        const bounceHeight = 60;
        const z = bounceHeight * Math.sin(t * Math.PI * 0.7) + 10;
        points.push({ x, y, z });
      }
      
      for (let i = 1; i <= 25; i++) {
        const t = i / 25;
        const x = impX + t * (stumpX - impX);
        const y = impY + t * (decision === 'OUT' ? -impY : -30 - impY);
        const z = 45 + (decision === 'OUT' ? -t * 20 : t * 30);
        points.push({ x, y, z: Math.max(0, z) });
      }
      
      return points;
    }

    // Use the actual trajectory data passed in
    const points: { x: number; y: number; z: number }[] = [];
    
    // Interpolate the trajectory for smooth animation
    for (let i = 0; i < trajectory.length - 1; i++) {
      const current = trajectory[i];
      const next = trajectory[i + 1];
      
      // Add intermediate points for smoother animation
      const steps = 5;
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        points.push({
          x: current.x + (next.x - current.x) * t,
          y: current.y + ((next as any).y !== undefined ? ((next as any).y - (current as any).y) * t : 0),
          z: current.z + (next.z - current.z) * t,
        });
      }
    }
    
    // Add the last point
    const lastPoint = trajectory[trajectory.length - 1];
    points.push({
      x: lastPoint.x,
      y: (lastPoint as any).y || 50,
      z: lastPoint.z,
    });

    // Normalize points to canvas coordinates
    const maxX = Math.max(...points.map(p => p.x));
    const minX = Math.min(...points.map(p => p.x));
    const maxZ = Math.max(...points.map(p => p.z));
    
    return points.map(p => ({
      x: 50 + ((p.x - minX) / (maxX - minX || 1)) * 530,
      y: p.y - 50, // Center y around 0
      z: (p.z / (maxZ || 1)) * 220,
    }));
  }, [trajectory, impactPoint, decision]);

  const smoothTrajectory = useRef(generateSmoothTrajectory());

  // Update trajectory when props change
  useEffect(() => {
    smoothTrajectory.current = generateSmoothTrajectory();
    // Reset animation when new trajectory arrives
    setProgress(0);
    setPhase('tracking');
    setIsPlaying(false);
  }, [generateSmoothTrajectory, trajectory]);

  const drawSideView = (ctx: CanvasRenderingContext2D, width: number, height: number, currentIndex: number) => {
    const groundY = height * 0.65;

    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
    skyGradient.addColorStop(0, '#0a0a1a');
    skyGradient.addColorStop(1, '#101020');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.6);

    // Ground
    const groundGradient = ctx.createLinearGradient(0, groundY, 0, height);
    groundGradient.addColorStop(0, '#1a3d16');
    groundGradient.addColorStop(1, '#0f2a0d');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Pitch strip with realistic texture
    const pitchGradient = ctx.createLinearGradient(30, 0, width - 30, 0);
    pitchGradient.addColorStop(0, '#a08050');
    pitchGradient.addColorStop(0.5, '#c4a574');
    pitchGradient.addColorStop(1, '#a08050');
    ctx.fillStyle = pitchGradient;
    ctx.fillRect(30, groundY - 2, width - 60, 25);

    // Crease lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 100, groundY);
    ctx.lineTo(width - 100, groundY + 20);
    ctx.stroke();

    // Draw stumps
    drawStumps(ctx, 45, groundY, 0.6, '#8b7355');
    drawStumps(ctx, width - 60, groundY, 1, phase === 'decision' && decision === 'OUT' ? '#ef4444' : '#d4a76a');

    // Draw batsman
    drawBatsman(ctx, width - 120, groundY);

    // Impact zone indicator (appears during zones phase)
    if (phase === 'zones' || phase === 'prediction' || phase === 'decision') {
      // Leg stump zone
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(width - 90, groundY - 80, 40, 80);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(width - 90, groundY - 80, 40, 80);

      ctx.font = '9px system-ui';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('IMPACT', width - 70, groundY - 85);
      ctx.fillText('ZONE', width - 70, groundY - 75);
    }

    // Draw trajectory
    const points = smoothTrajectory.current;
    
    // Predicted path (dashed)
    if (phase === 'prediction' || phase === 'decision') {
      ctx.beginPath();
      ctx.strokeStyle = decision === 'OUT' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      
      const impactIdx = Math.floor(points.length * 0.75);
      for (let i = impactIdx; i < points.length; i++) {
        const screenX = points[i].x * (width / 650);
        const screenY = groundY - points[i].z * 0.8;
        if (i === impactIdx) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ball trail with glow effect
    if (currentIndex > 0) {
      const trailLength = Math.min(currentIndex, 40);
      
      // Outer glow trail
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      for (let i = Math.max(0, currentIndex - trailLength); i <= currentIndex; i++) {
        const screenX = points[i].x * (width / 650);
        const screenY = groundY - points[i].z * 0.8;
        if (i === Math.max(0, currentIndex - trailLength)) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      // Core trail
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      for (let i = Math.max(0, currentIndex - trailLength); i <= currentIndex; i++) {
        const screenX = points[i].x * (width / 650);
        const screenY = groundY - points[i].z * 0.8;
        if (i === Math.max(0, currentIndex - trailLength)) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
    }

    // Bounce marker
    if (progress > 50) {
      const bounceScreenX = (bouncePoint?.x || 280) * (width / 650);
      
      // Ripple effect
      const ripplePhase = (Date.now() / 300) % 1;
      ctx.beginPath();
      ctx.arc(bounceScreenX, groundY, 15 + ripplePhase * 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.5 - ripplePhase * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(bounceScreenX, groundY, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'center';
      ctx.fillText('PITCH', bounceScreenX, groundY + 35);
    }

    // Impact marker
    if (progress > 75) {
      const impactScreenX = (impactPoint?.x || 480) * (width / 650);
      
      const ripplePhase = (Date.now() / 300) % 1;
      ctx.beginPath();
      ctx.arc(impactScreenX, groundY - 45, 18 + ripplePhase * 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(249, 115, 22, ${0.5 - ripplePhase * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(impactScreenX, groundY - 45, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = '#f97316';
      ctx.textAlign = 'center';
      ctx.fillText('IMPACT', impactScreenX, groundY - 65);
    }

    // Draw ball
    if (currentIndex < points.length) {
      const point = points[currentIndex];
      const screenX = point.x * (width / 650);
      const screenY = groundY - point.z * 0.8;
      drawBall(ctx, screenX, screenY);
    }
  };

  const drawTopView = (ctx: CanvasRenderingContext2D, width: number, height: number, currentIndex: number) => {
    // Dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    // Pitch outline
    const pitchWidth = 120;
    const pitchLeft = (width - pitchWidth) / 2;
    
    ctx.fillStyle = '#2d4a28';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#c4a574';
    ctx.fillRect(pitchLeft, 20, pitchWidth, height - 40);

    // Crease lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    
    // Bowling crease
    ctx.beginPath();
    ctx.moveTo(pitchLeft, 50);
    ctx.lineTo(pitchLeft + pitchWidth, 50);
    ctx.stroke();

    // Batting crease
    ctx.beginPath();
    ctx.moveTo(pitchLeft, height - 50);
    ctx.lineTo(pitchLeft + pitchWidth, height - 50);
    ctx.stroke();

    // Stumps (top view)
    ctx.fillStyle = '#d4a76a';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(width / 2 + i * 10, 50, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(width / 2 + i * 10, height - 50, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stump zone
    if (phase === 'prediction' || phase === 'decision') {
      ctx.fillStyle = decision === 'OUT' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)';
      ctx.fillRect(width / 2 - 15, height - 55, 30, 10);
      ctx.strokeStyle = decision === 'OUT' ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(width / 2 - 15, height - 55, 30, 10);
    }

    // Draw trajectory from top
    const points = smoothTrajectory.current;
    
    if (currentIndex > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      
      for (let i = 0; i <= currentIndex; i++) {
        const screenX = width / 2 + points[i].y * 2;
        const screenY = 50 + (points[i].x / 650) * (height - 100);
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      for (let i = 0; i <= currentIndex; i++) {
        const screenX = width / 2 + points[i].y * 2;
        const screenY = 50 + (points[i].x / 650) * (height - 100);
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
    }

    // Predicted path
    if (phase === 'prediction' || phase === 'decision') {
      ctx.beginPath();
      ctx.strokeStyle = decision === 'OUT' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      
      const impactIdx = Math.floor(points.length * 0.75);
      for (let i = impactIdx; i < points.length; i++) {
        const screenX = width / 2 + points[i].y * 2;
        const screenY = 50 + (points[i].x / 650) * (height - 100);
        if (i === impactIdx) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current ball position
    if (currentIndex < points.length) {
      const point = points[currentIndex];
      const screenX = width / 2 + point.y * 2;
      const screenY = 50 + (point.x / 650) * (height - 100);
      
      // Ball shadow
      ctx.beginPath();
      ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Labels
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('BOWLER END', width / 2, 30);
    ctx.fillText('BATTING END', width / 2, height - 15);
  };

  const drawStumpView = (ctx: CanvasRenderingContext2D, width: number, height: number, currentIndex: number) => {
    // Dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    const groundY = height * 0.75;
    
    // Ground
    ctx.fillStyle = '#1a3d16';
    ctx.fillRect(0, groundY, width, height - groundY);

    // Pitch
    ctx.fillStyle = '#c4a574';
    ctx.fillRect(width * 0.3, groundY, width * 0.4, 20);

    // Stumps zone overlay
    const stumpWidth = 80;
    const stumpHeight = 100;
    const stumpLeft = (width - stumpWidth) / 2;
    const stumpTop = groundY - stumpHeight;

    // Zone areas
    const zones = [
      { color: 'rgba(239, 68, 68, 0.3)', label: 'LEG' },
      { color: 'rgba(249, 115, 22, 0.3)', label: 'MIDDLE' },
      { color: 'rgba(34, 197, 94, 0.3)', label: 'OFF' },
    ];

    zones.forEach((zone, i) => {
      ctx.fillStyle = zone.color;
      ctx.fillRect(stumpLeft + (stumpWidth / 3) * i, stumpTop, stumpWidth / 3, stumpHeight);
      ctx.font = '9px system-ui';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(zone.label, stumpLeft + (stumpWidth / 3) * i + stumpWidth / 6, stumpTop - 10);
    });

    // Stumps
    const stumpGap = stumpWidth / 4;
    ctx.fillStyle = '#d4a76a';
    for (let i = 1; i <= 3; i++) {
      ctx.fillRect(stumpLeft + stumpGap * i - 3, stumpTop, 6, stumpHeight);
    }

    // Bails
    ctx.fillStyle = '#d4a76a';
    ctx.fillRect(stumpLeft + stumpGap - 5, stumpTop - 5, stumpGap + 10, 5);
    ctx.fillRect(stumpLeft + stumpGap * 2 - 5, stumpTop - 5, stumpGap + 10, 5);

    // Draw predicted hit point
    if (phase === 'prediction' || phase === 'decision') {
      const hitX = decision === 'OUT' ? width / 2 - 5 : width / 2 - 40;
      const hitY = decision === 'OUT' ? groundY - 50 : groundY - 120;

      // Predicted hit marker
      ctx.beginPath();
      ctx.arc(hitX, hitY, 20, 0, Math.PI * 2);
      ctx.fillStyle = decision === 'OUT' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
      ctx.fill();
      ctx.strokeStyle = decision === 'OUT' ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hitX, hitY, 8, 0, Math.PI * 2);
      ctx.fillStyle = decision === 'OUT' ? '#ef4444' : '#22c55e';
      ctx.fill();

      // Label
      ctx.font = 'bold 12px system-ui';
      ctx.fillStyle = decision === 'OUT' ? '#ef4444' : '#22c55e';
      ctx.textAlign = 'center';
      ctx.fillText(decision === 'OUT' ? 'HITTING' : 'MISSING', hitX, hitY - 35);
    }

    // Ball approaching (animated)
    if (currentIndex < smoothTrajectory.current.length) {
      const point = smoothTrajectory.current[currentIndex];
      const progressRatio = currentIndex / smoothTrajectory.current.length;
      const ballScale = 0.3 + progressRatio * 0.7;
      const ballX = width / 2 + point.y * 3;
      const ballY = height * 0.3 + progressRatio * (groundY - 50 - height * 0.3);

      // Ball trail
      for (let i = 0; i < 5; i++) {
        const trailAlpha = (5 - i) / 10;
        const trailY = ballY - i * 8;
        ctx.beginPath();
        ctx.arc(ballX, trailY, 8 * ballScale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${trailAlpha})`;
        ctx.fill();
      }

      // Ball
      ctx.beginPath();
      ctx.arc(ballX, ballY, 12 * ballScale, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Height guide
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(width * 0.15, groundY);
    ctx.lineTo(width * 0.15, stumpTop);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '10px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('STUMP HEIGHT', width * 0.15, stumpTop - 20);
  };

  const drawStumps = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    groundY: number, 
    scale: number,
    color: string
  ) => {
    const stumpHeight = 70 * scale;
    const stumpWidth = 3 * scale;
    const gap = 8 * scale;

    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(x + i * gap - stumpWidth / 2, groundY - stumpHeight, stumpWidth, stumpHeight);
    }

    ctx.fillStyle = color;
    ctx.fillRect(x - gap - 2, groundY - stumpHeight - 3, gap * 2 + 4, 3);

    ctx.shadowBlur = 0;
  };

  const drawBatsman = (ctx: CanvasRenderingContext2D, x: number, groundY: number) => {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
    
    ctx.beginPath();
    ctx.ellipse(x, groundY - 50, 15, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x, groundY - 95, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 8, groundY - 20, 8, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#a08050';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 10, groundY - 60);
    ctx.lineTo(x - 30, groundY - 30);
    ctx.stroke();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 25;
    
    const gradient = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, 12);
    gradient.addColorStop(0, '#fca5a5');
    gradient.addColorStop(0.3, '#ef4444');
    gradient.addColorStop(1, '#b91c1c');
    
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 7, -0.5, 0.5);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    
    ctx.shadowBlur = 0;
  };

  const drawHUD = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // View mode indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 100, 25);
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'left';
    ctx.fillText(`📹 ${viewMode.toUpperCase()} VIEW`, 20, 27);

    // Phase indicator
    if (phase !== 'decision') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width - 130, 10, 120, 25);
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'right';
      const phaseLabels = {
        tracking: 'TRACKING...',
        zones: 'ANALYZING ZONES',
        prediction: 'PREDICTING...',
        decision: '',
      };
      ctx.fillText(phaseLabels[phase], width - 20, 27);
    }

    // Decision overlay
    if (phase === 'decision') {
      const decisionBg = decision === 'OUT' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)';
      ctx.fillStyle = decisionBg;
      ctx.fillRect(width / 2 - 80, height / 2 - 40, 160, 80);
      
      ctx.strokeStyle = decision === 'OUT' ? '#fca5a5' : '#86efac';
      ctx.lineWidth = 3;
      ctx.strokeRect(width / 2 - 80, height / 2 - 40, 160, 80);

      ctx.font = 'bold 36px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(decision === 'OUT' ? 'OUT' : 'NOT OUT', width / 2, height / 2);
    }

    // Frame counter
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, height - 35, 110, 25);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'left';
    const frame = Math.floor((progress / 100) * 120);
    ctx.fillText(`FRAME: ${frame.toString().padStart(3, '0')}/120`, 20, height - 18);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const totalPoints = smoothTrajectory.current.length;
    const currentIndex = Math.floor((progress / 100) * (totalPoints - 1));

    // Draw based on view mode
    switch (viewMode) {
      case 'side':
        drawSideView(ctx, width, height, currentIndex);
        break;
      case 'top':
        drawTopView(ctx, width, height, currentIndex);
        break;
      case 'stump':
        drawStumpView(ctx, width, height, currentIndex);
        break;
    }

    drawHUD(ctx, width, height);
  }, [progress, viewMode, phase, decision, bouncePoint, impactPoint]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Animation loop for ripple effects
  useEffect(() => {
    if (progress > 50) {
      const redrawInterval = setInterval(draw, 50);
      return () => clearInterval(redrawInterval);
    }
  }, [progress, draw]);

  useEffect(() => {
    if (isPlaying) {
      const animate = (timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const delta = timestamp - lastTimeRef.current;
        
        if (delta > 16) {
          lastTimeRef.current = timestamp;
          setProgress(prev => {
            const next = prev + speed * 0.5;
            
            // Update phases based on progress
            if (next >= 50 && next < 75 && phase === 'tracking') {
              setPhase('zones');
            } else if (next >= 75 && next < 95 && phase === 'zones') {
              setPhase('prediction');
            } else if (next >= 100) {
              setPhase('decision');
              setIsPlaying(false);
              return 100;
            }
            
            return next;
          });
        }
        
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = 0;
    };
  }, [isPlaying, speed, phase]);

  const handlePlayPause = () => {
    if (progress >= 100) {
      setProgress(0);
      setPhase('tracking');
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
    setPhase('tracking');
  };

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden border border-border bg-black">
        <canvas
          ref={canvasRef}
          width={650}
          height={300}
          className="w-full h-auto"
        />
        
        {/* View mode selector */}
        <div className="absolute top-3 right-3 flex gap-1">
          <Button
            variant={viewMode === 'side' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('side')}
            className="h-7 px-2 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Side
          </Button>
          <Button
            variant={viewMode === 'top' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('top')}
            className="h-7 px-2 text-xs"
          >
            <Video className="h-3 w-3 mr-1" />
            Top
          </Button>
          <Button
            variant={viewMode === 'stump' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('stump')}
            className="h-7 px-2 text-xs"
          >
            <Target className="h-3 w-3 mr-1" />
            Stump
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1 border border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-muted-foreground">Pitch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#f97316]" />
            <span className="text-muted-foreground">Impact</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 bg-card rounded-lg p-3 border border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePlayPause}
            className="h-9 w-9"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            className="h-9 w-9"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1">
          <Slider
            value={[progress]}
            onValueChange={([val]) => {
              setProgress(val);
              setIsPlaying(false);
              if (val >= 100) setPhase('decision');
              else if (val >= 75) setPhase('prediction');
              else if (val >= 50) setPhase('zones');
              else setPhase('tracking');
            }}
            max={100}
            step={0.5}
            className="cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FastForward className="h-4 w-4" />
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-background border border-input rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>
    </div>
  );
}
